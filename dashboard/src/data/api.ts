// Live data layer. Every loader returns the same shape as the demo data in
// mock.ts; when no backend is configured (hasBackend === false) pages keep
// rendering the mocks, so the dashboard still works standalone.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase, hasBackend } from '../lib/supabase';
import {
  EventRow, LiveRow, ReviewItem, AccountRow, AuditRow, Method,
} from './mock';

export { hasBackend };

// Re-fetch trigger shared by realtime subscribers.
export function useLoaded<T>(loader: () => Promise<T | null>, fallback: T, deps: unknown[] = []): T {
  const [data, setData] = useState<T>(fallback);
  useEffect(() => {
    if (!hasBackend) return;
    let alive = true;
    loader().then((d) => { if (alive && d != null) setData(d); })
      .catch((e) => console.error('load failed', e));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

// ── formatting helpers ──────────────────────────────────────────────
const PALETTE = ['#3f9bd8', '#35a463', '#8e5fae', '#e2913f', '#d95950'];

export function initialsOf(name: string): string {
  const parts = name.replace(',', '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}
export function colorOf(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const fmtClock = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours() % 12 === 0 ? 12 : d.getHours() % 12}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const fmtWindow = (a: string, b: string) => `${fmtTime(a)} – ${fmtTime(b)}`;
const METHOD_MAP: Record<string, Method> = { qr: 'QR', rfid: 'RFID', manual: 'Manual' };

function eventStatus(e: DbEvent, checkers: number): EventRow['status'] {
  const now = Date.now();
  if (now > new Date(e.checking_closes_at).getTime()) return 'closed';
  if (now >= new Date(e.checking_opens_at).getTime()) return 'live';
  return checkers === 0 ? 'draft' : 'upcoming';
}

interface DbEvent {
  id: string; name: string; venue: string | null; description: string | null;
  starts_at: string; ends_at: string;
  checking_opens_at: string; checking_closes_at: string;
  is_required: boolean; requires_time_out: boolean; fine_amount: number;
}

// ── events ──────────────────────────────────────────────────────────
export async function loadEvents(): Promise<EventRow[] | null> {
  if (!supabase) return null;
  const [{ data: events }, { data: scans }, { count: roster }] = await Promise.all([
    supabase.from('events')
      .select('*, event_checkers(count), event_rsvps(count)')
      .order('starts_at', { ascending: false }),
    supabase.from('attendance').select('event_id, scan_type'),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('active', true),
  ]);
  if (!events) return null;
  const inCounts = new Map<string, number>();
  for (const s of scans ?? []) {
    if (s.scan_type === 'in') inCounts.set(s.event_id, (inCounts.get(s.event_id) ?? 0) + 1);
  }
  return (events as any[]).map((e) => {
    const checkers = e.event_checkers?.[0]?.count ?? 0;
    const rsvps = e.event_rsvps?.[0]?.count ?? 0;
    const present = inCounts.get(e.id) ?? 0;
    const status = eventStatus(e, checkers);
    return {
      id: e.id, name: e.name, venue: e.venue ?? '—',
      required: e.is_required, timeOut: e.requires_time_out || undefined,
      rsvps: rsvps || undefined,
      date: fmtDate(e.starts_at),
      window: fmtWindow(e.checking_opens_at, e.checking_closes_at),
      checkers,
      attendance: status === 'draft' || status === 'upcoming' || !roster
        ? null : Math.round((present / roster) * 100),
      status,
    } satisfies EventRow;
  });
}

export interface NewEventInput {
  name: string; venue: string; description: string;
  starts_at: string; ends_at: string;
  checking_opens_at: string; checking_closes_at: string;
  is_required: boolean; requires_time_out: boolean; fine_amount: number;
  minimum_stay_minutes?: number;
  checkers: { profile_id: string; school: string }[];
}

export async function createEvent(input: NewEventInput): Promise<string | null> {
  if (!supabase) return null; // demo mode: pretend success
  const { data: session } = await supabase.auth.getUser();
  const { checkers, ...event } = input;
  const { data, error } = await supabase.from('events')
    .insert({ ...event, created_by: session.user?.id })
    .select('id').single();
  if (error) return error.message;
  if (checkers.length) {
    const { error: cErr } = await supabase.from('event_checkers')
      .insert(checkers.map((c) => ({ ...c, event_id: data.id })));
    if (cErr) return cErr.message;
  }
  return null;
}

export async function loadCheckerProfiles(): Promise<{ id: string; full_name: string }[] | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles')
    .select('id, full_name').eq('role', 'checker').eq('active', true);
  return data;
}

// ── live attendance ─────────────────────────────────────────────────
export interface LiveView {
  event: { id: string; name: string; sub: string; windowLine: string; closed: boolean; closesLabel: string };
  present: number; roster: number; rate: number; forReview: number;
  rows: LiveRow[];
  lastSync: string;
}

export async function loadLiveView(): Promise<LiveView | null> {
  if (!supabase) return null;
  const { data: events } = await supabase.from('events')
    .select('*').order('checking_opens_at', { ascending: false });
  if (!events?.length) return null;
  const now = Date.now();
  const ev = (events as DbEvent[]).find((e) =>
    now >= new Date(e.checking_opens_at).getTime() && now <= new Date(e.ends_at).getTime())
    ?? (events as DbEvent[]).find((e) => new Date(e.checking_opens_at).getTime() <= now)
    ?? (events as DbEvent[])[0];

  const [{ data: scans }, { count: roster }] = await Promise.all([
    supabase.from('attendance')
      .select('*, students(full_name), checker:profiles!attendance_checker_id_fkey(full_name)')
      .eq('event_id', ev.id).eq('scan_type', 'in')
      .order('scanned_at', { ascending: false }).limit(200),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('active', true),
  ]);

  const closesAt = new Date(ev.checking_closes_at).getTime();
  const rows: LiveRow[] = (scans ?? []).map((a: any) => {
    const scanned = new Date(a.scanned_at).getTime();
    const synced = new Date(a.synced_at).getTime();
    const offline = synced - scanned > 90_000;
    const lateMin = Math.round((scanned - closesAt) / 60_000);
    const name = a.students?.full_name ?? 'Unknown';
    return {
      initials: initialsOf(name), color: colorOf(name), name,
      note: a.note ? `“${a.note}”` : undefined,
      noteTone: a.status === 'for_review' ? 'orange' : 'muted',
      timeIn: fmtClock(a.scanned_at),
      method: METHOD_MAP[a.method] ?? 'QR',
      checker: a.checker?.full_name ?? '—',
      school: a.school,
      sync: offline
        ? `${fmtClock(a.scanned_at)} → ${fmtClock(a.synced_at)} offline sync`
        : `${fmtClock(a.scanned_at)} · ${fmtClock(a.synced_at)}`,
      syncOffline: offline || undefined,
      status: a.status === 'for_review' ? 'review' : 'valid',
      reviewLabel: a.status === 'for_review' ? `For review +${Math.max(lateMin, 1)}m` : undefined,
      highlight: a.status === 'for_review' || undefined,
    };
  });

  const present = rows.length;
  const total = roster ?? 0;
  return {
    event: {
      id: ev.id, name: ev.name,
      sub: `${ev.venue ?? ''} · ${new Date(ev.starts_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · check-in ${fmtWindow(ev.checking_opens_at, ev.checking_closes_at)}`,
      windowLine: fmtWindow(ev.checking_opens_at, ev.checking_closes_at),
      closed: now > closesAt,
      closesLabel: fmtTime(ev.checking_closes_at),
    },
    present, roster: total,
    rate: total ? Math.round((present / total) * 100) : 0,
    forReview: rows.filter((r) => r.status === 'review').length,
    rows,
    lastSync: rows.length ? fmtTime((scans as any[])[0].synced_at) : '—',
  };
}

export function subscribeAttendance(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const sb = supabase;
  const ch = sb.channel('live-attendance')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, onChange)
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

// ── review queue ────────────────────────────────────────────────────
export async function loadReviewItems(): Promise<ReviewItem[] | null> {
  if (!supabase) return null;
  const [{ data: late }, { data: excuses }] = await Promise.all([
    supabase.from('attendance')
      .select('*, students(full_name, student_no, course, year_level, section), events(name, checking_closes_at), checker:profiles!attendance_checker_id_fkey(full_name)')
      .eq('status', 'for_review').order('scanned_at', { ascending: false }),
    supabase.from('excuses')
      .select('*, students(full_name, student_no, course, year_level, section), events(name, starts_at, fine_amount)')
      .eq('status', 'pending').order('filed_at', { ascending: false }),
  ]);

  const courseOf = (s: any) =>
    s ? [s.course, s.year_level != null ? `${s.year_level}-${s.section ?? ''}` : ''].filter(Boolean).join(' ') : '';

  const lateItems: ReviewItem[] = (late ?? []).map((a: any) => {
    const lateMin = Math.max(1, Math.round(
      (new Date(a.scanned_at).getTime() - new Date(a.events.checking_closes_at).getTime()) / 60_000));
    const name = a.students?.full_name ?? 'Unknown';
    return {
      id: `att:${a.id}`, kind: 'late',
      tag: `LATE SCAN · +${lateMin} min`, when: fmtTime(a.scanned_at),
      name, course: courseOf(a.students),
      line: `${a.note ? `“${a.note}”` : 'No note attached'} · ${a.checker?.full_name ?? '—'} · ${a.school}`,
      detail: {
        initials: initialsOf(name), color: colorOf(name),
        studentNo: a.students?.student_no ?? '—',
        event: a.events?.name ?? '—', statusChip: 'For review · late scan',
        tiles: [
          { label: 'SCANNED AT', value: fmtTime(a.scanned_at), sub: `+${lateMin} min after close`, subTone: 'red' },
          { label: 'SYNCED AT', value: fmtTime(a.synced_at), sub: 'device online' },
          { label: 'METHOD · SCHOOL', value: `${METHOD_MAP[a.method] ?? a.method} · ${a.school}`, sub: a.device_id ? `device ${a.device_id}` : '—' },
          { label: 'CHECKER', value: a.checker?.full_name ?? '—', sub: `assigned · ${a.school}` },
        ],
        noteLabel: 'CHECKER NOTE',
        note: a.note ? `“${a.note}”` : 'No note attached by the checker.',
      },
    };
  });

  const excuseItems: ReviewItem[] = (excuses ?? []).map((x: any) => {
    const name = x.students?.full_name ?? 'Unknown';
    return {
      id: `exc:${x.id}`, kind: 'excuse',
      tag: 'EXCUSE · pending', when: fmtDate(x.filed_at),
      name, course: courseOf(x.students),
      line: `${x.events?.name ?? '—'} · ${x.attachment_urls?.length ?? 0} attachment${(x.attachment_urls?.length ?? 0) === 1 ? '' : 's'}`,
      detail: {
        initials: initialsOf(name), color: colorOf(name),
        studentNo: x.students?.student_no ?? '—',
        event: x.events?.name ?? '—', statusChip: 'Pending · excuse',
        tiles: [
          { label: 'EVENT MISSED', value: x.events ? new Date(x.events.starts_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—', sub: 'marked absent' },
          { label: 'FILED', value: new Date(x.filed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }), sub: '' },
          { label: 'ATTACHMENTS', value: String(x.attachment_urls?.length ?? 0), sub: '' },
          { label: 'FINE AT STAKE', value: `₱${Number(x.events?.fine_amount ?? 0).toFixed(2)}`, sub: 'waived if approved' },
        ],
        noteLabel: 'STUDENT REASON',
        note: `“${x.reason}”`,
      },
    };
  });

  return [...lateItems, ...excuseItems];
}

// id is "att:<uuid>" or "exc:<uuid>" from loadReviewItems.
export async function decideReview(id: string, approve: boolean): Promise<string | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getUser();
  const patch = {
    status: approve ? 'approved' : 'rejected',
    reviewed_by: session.user?.id, reviewed_at: new Date().toISOString(),
  };
  const [kind, rowId] = id.split(':');
  const { error } = await supabase
    .from(kind === 'att' ? 'attendance' : 'excuses').update(patch).eq('id', rowId);
  return error ? error.message : null;
}

// ── accounts ────────────────────────────────────────────────────────
export async function loadAccounts(): Promise<AccountRow[] | null> {
  if (!supabase) return null;
  const [{ data: profiles }, { data: students }] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('students').select('*').eq('active', true),
  ]);
  if (!profiles) return null;
  const byProfile = new Map((students ?? []).map((s: any) => [s.profile_id, s]));
  const roleMap: Record<string, AccountRow['role']> =
    { student: 'student', checker: 'checker', event_maker: 'maker', super_admin: 'maker' };
  const statusMap: Record<string, [AccountRow['status'], string]> = {
    activated: ['activated', 'Activated'],
    invited: ['invited', 'Invited'],
    never_logged_in: ['never', 'Never logged in'],
  };
  const rows: AccountRow[] = (profiles as any[]).map((p) => {
    const s = byProfile.get(p.id);
    const [status, statusLabel] = p.active
      ? statusMap[p.account_status] ?? ['never', '—'] : ['deactivated' as const, 'Deactivated'];
    return {
      initials: initialsOf(p.full_name), color: colorOf(p.full_name),
      name: p.full_name, email: p.email,
      studentNo: s?.student_no ?? '—',
      course: s ? `${s.course ?? ''} ${s.year_level ?? ''}-${s.section ?? ''}`.trim() : '—',
      status, statusLabel, lastLogin: '—',
      role: roleMap[p.role] ?? 'student',
    };
  });
  // Roster records that never activated an account.
  for (const s of (students ?? []) as any[]) {
    if (s.profile_id) continue;
    rows.push({
      initials: initialsOf(s.full_name), color: colorOf(s.full_name),
      name: s.full_name, email: s.email ?? '—', studentNo: s.student_no,
      course: `${s.course ?? ''} ${s.year_level ?? ''}-${s.section ?? ''}`.trim(),
      status: 'never', statusLabel: 'No account', lastLogin: '—', role: 'student',
    });
  }
  return rows;
}

export interface ProvisionInput {
  full_name: string; email: string; role: 'student' | 'checker' | 'event_maker';
  mode: 'invite' | 'temp_password';
  student_no?: string; course?: string; year_level?: number; section?: string;
}

export async function provisionAccount(input: ProvisionInput):
  Promise<{ error?: string; temp_password?: string }> {
  if (!supabase) return { temp_password: 'demo-mode' };
  const { data, error } = await supabase.functions.invoke('provision-account', { body: input });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { temp_password: data?.temp_password };
}

// Account maintenance — all run through the edge function (service key
// stays server-side).
async function accountAction(body: Record<string, unknown>):
  Promise<{ error?: string; temp_password?: string }> {
  if (!supabase) return {};
  const { data, error } = await supabase.functions.invoke('provision-account', { body });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { temp_password: data?.temp_password };
}

export const resetPassword = (email: string) =>
  accountAction({ action: 'reset_password', email });
export const resendInvite = (email: string) =>
  accountAction({ action: 'resend_invite', email });
export const setAccountActive = (email: string, active: boolean) =>
  accountAction({ action: 'set_active', email, active });

// ── CSV roster import (spec: student_no, name, email, course, year, section)
export interface CsvStudent {
  student_no: string; full_name: string; email: string | null;
  course: string | null; year_level: number | null; section: string | null;
}

export function parseStudentsCsv(text: string): { rows: CsvStudent[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], errors: ['empty file'] };
  // Header row is optional; detect it by a non-numeric first field.
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('student') || first.includes('name');
  const rows: CsvStudent[] = [];
  for (const [i, line] of lines.slice(hasHeader ? 1 : 0).entries()) {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 2 || !cells[0]) {
      errors.push(`line ${i + 1 + (hasHeader ? 1 : 0)}: needs at least student_no, name`);
      continue;
    }
    rows.push({
      student_no: cells[0],
      full_name: cells[1],
      email: cells[2] || null,
      course: cells[3] || null,
      year_level: cells[4] ? Number(cells[4]) || null : null,
      section: cells[5] || null,
    });
  }
  return { rows, errors };
}

export async function importStudents(rows: CsvStudent[]): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('students')
    .upsert(rows, { onConflict: 'student_no' });
  return error ? error.message : null;
}

// ── close-out: fines for absentees without an approved excuse ───────
export async function generateFines(eventId: string):
  Promise<{ error?: string; count?: number }> {
  if (!supabase) return { count: 0 };
  const { data, error } = await supabase.rpc('generate_fines', { p_event: eventId });
  if (error) return { error: error.message };
  return { count: data as number };
}

// ── settings (master data, super-admin) ─────────────────────────────
export async function loadSettings(): Promise<Record<string, string> | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('settings').select('key, value');
  if (!data) return null;
  return Object.fromEntries((data as any[]).map((r) => [r.key, JSON.stringify(r.value)]));
}

export async function saveSetting(key: string, value: unknown): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('settings')
    .upsert({ key, value }, { onConflict: 'key' });
  return error ? error.message : null;
}

// ── CSV download helper ─────────────────────────────────────────────
export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── audit log ───────────────────────────────────────────────────────
export async function loadAudit(): Promise<AuditRow[] | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('audit_log')
    .select('*, actor:profiles(full_name)')
    .order('created_at', { ascending: false }).limit(60);
  if (!data) return null;
  const tone: Record<string, AuditRow['actionTone']> =
    { INSERT: 'blue', UPDATE: 'purple', DELETE: 'red' };
  return (data as any[]).map((r) => {
    const oldS = r.old_values?.status;
    const newS = r.new_values?.status;
    const change: AuditRow['change'] = oldS && newS && oldS !== newS
      ? { kind: 'diff', from: String(oldS), fromTone: 'orange', to: String(newS), toTone: 'green', note: '' }
      : { kind: 'text', text: summarize(r) };
    return {
      time: new Date(r.created_at).toLocaleTimeString('en-PH', { hour12: false }),
      actor: r.actor?.full_name ?? 'system',
      action: r.action, actionTone: tone[r.action] ?? 'dark',
      record: `${r.table_name} · ${String(r.record_id).slice(0, 8)}`,
      change,
    };
  });
}

function summarize(r: any): string {
  const v = r.new_values ?? r.old_values ?? {};
  if (r.table_name === 'attendance') {
    return `scan ${v.scan_type ?? ''} · ${String(v.method ?? '').toUpperCase()} · ${v.school ?? ''}`;
  }
  if (r.table_name === 'fines') return `fine ₱${v.amount ?? ''} · ${v.status ?? ''}`;
  if (r.table_name === 'excuses') return `excuse · ${v.status ?? ''}`;
  if (r.table_name === 'profiles') return `${v.role ?? ''} · ${v.account_status ?? ''}`;
  return r.action.toLowerCase();
}

// ── batch QR cards ──────────────────────────────────────────────────
export interface QrCard { qr: string; name: string; no: string; course: string }

export async function loadQrCards(): Promise<QrCard[] | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('students')
    .select('full_name, student_no, course, year_level, section, qr_token')
    .eq('active', true).order('full_name').limit(1000);
  if (!data) return null;
  return Promise.all((data as any[]).map(async (s) => ({
    qr: await QRCode.toDataURL(s.qr_token, { margin: 0, width: 240, color: { dark: '#232a31' } }),
    name: s.full_name.replace(', ', ',\n'),
    no: s.student_no,
    course: `${s.course ?? ''} ${s.year_level ?? ''}-${s.section ?? ''}`.trim(),
  })));
}

// ── dashboard stats ─────────────────────────────────────────────────
export interface DashStats {
  events: number; students: number; avgRate: number | null; pendingReview: number;
  pendingExcuses: number; unpaidFines: number;
  schoolBars: { school: string; pct: number }[];
  trend: { date: string; h: number; latest?: boolean; tip?: string }[];
  absentees: { name: string; course: string; missed: string; fines: string }[];
}

export async function loadDashStats(): Promise<DashStats | null> {
  if (!supabase) return null;
  const [ev, st, att, rev, exc, fin] = await Promise.all([
    supabase.from('events').select('id, name, starts_at, checking_opens_at').order('starts_at'),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('attendance').select('event_id, scan_type, school'),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('status', 'for_review'),
    supabase.from('excuses').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('fines').select('amount, status, students(full_name, course, year_level, section)').eq('status', 'unpaid'),
  ]);
  const roster = st.count ?? 0;
  const inScans = (att.data ?? []).filter((a: any) => a.scan_type === 'in');
  const byEvent = new Map<string, number>();
  const bySchool = new Map<string, number>();
  for (const a of inScans as any[]) {
    byEvent.set(a.event_id, (byEvent.get(a.event_id) ?? 0) + 1);
    bySchool.set(a.school, (bySchool.get(a.school) ?? 0) + 1);
  }

  const started = (ev.data ?? []).filter((e: any) => new Date(e.checking_opens_at).getTime() <= Date.now());
  const trendSrc = started.slice(-8);
  const trend = trendSrc.map((e: any, i: number) => {
    const pct = roster ? Math.round(((byEvent.get(e.id) ?? 0) / roster) * 100) : 0;
    const latest = i === trendSrc.length - 1;
    return {
      date: new Date(e.starts_at).toLocaleDateString('en-PH', { month: 'numeric', day: '2-digit' }),
      h: Math.max(pct, 4), latest, tip: latest ? `${pct}%` : undefined,
    };
  });

  const maxSchool = Math.max(1, ...bySchool.values());
  const schoolBars = [...bySchool.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([school, n]) => ({ school, pct: Math.round((n / maxSchool) * 100) }));

  const finesByStudent = new Map<string, { name: string; course: string; n: number; total: number }>();
  for (const f of (fin.data ?? []) as any[]) {
    const name = f.students?.full_name ?? '—';
    const cur = finesByStudent.get(name) ?? {
      name,
      course: f.students ? `${f.students.course ?? ''} ${f.students.year_level ?? ''}-${f.students.section ?? ''}`.trim() : '—',
      n: 0, total: 0,
    };
    cur.n += 1;
    cur.total += Number(f.amount);
    finesByStudent.set(name, cur);
  }
  const absentees = [...finesByStudent.values()]
    .sort((a, b) => b.total - a.total).slice(0, 3)
    .map((s) => ({
      name: s.name, course: s.course,
      missed: `${s.n} of ${started.length}`, fines: `₱${s.total.toLocaleString()}`,
    }));

  const eventsWithScans = byEvent.size;
  return {
    events: ev.data?.length ?? 0,
    students: roster,
    avgRate: roster && eventsWithScans
      ? Math.round((inScans.length / (roster * eventsWithScans)) * 100) : null,
    pendingReview: (rev.count ?? 0) + (exc.count ?? 0),
    pendingExcuses: exc.count ?? 0,
    unpaidFines: (fin.data ?? []).reduce((sum: number, f: any) => sum + Number(f.amount), 0),
    schoolBars, trend, absentees,
  };
}
