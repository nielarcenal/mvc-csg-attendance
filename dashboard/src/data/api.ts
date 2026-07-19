// Live data layer. Every loader queries Supabase; without a backend
// configured the app renders a configuration notice (see App.tsx) —
// no sample data anywhere.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase, hasBackend } from '../lib/supabase';
import {
  EventRow, LiveRow, ReviewItem, AccountRow, AuditRow, Method, SCHOOLS,
} from './types';

export { hasBackend };

/** Loads via `loader`, starting from `fallback` (an empty state, never
 * sample data). `loading` is true until the first load settles. */
export function useLoaded<T>(loader: () => Promise<T | null>, fallback: T, deps: unknown[] = []): T {
  return useLoadedState(loader, fallback, deps).data;
}

export function useLoadedState<T>(loader: () => Promise<T | null>, fallback: T, deps: unknown[] = []):
  { data: T; loading: boolean; error: boolean; retry: () => void } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(hasBackend);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!hasBackend) return;
    let alive = true;
    setError(false);
    loader().then((d) => { if (alive) { if (d != null) setData(d); setLoading(false); } })
      .catch((e) => {
        console.error('load failed', e);
        if (alive) { setLoading(false); setError(true); }
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return { data, loading, error, retry: () => setAttempt((n) => n + 1) };
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

// FEATURE_BATCH_2 A3/A4: events carry a duration + per-day checking
// sessions and an audience (all students or selected schools).
export type DurationType = 'single_day' | 'one_week' | 'custom';
export type SessionMode = 'in_out' | 'in_only';

export interface SessionInput {
  id?: string;                // set when editing an existing session
  session_date: string;       // YYYY-MM-DD
  program: string;
  venue: string;
  mode: SessionMode;
  checking_opens_at: string;  // ISO
  checking_closes_at: string; // ISO
  sort_order: number;
}

export interface NewEventInput {
  name: string; venue: string; description: string;
  duration_type: DurationType;
  start_date: string; end_date: string;
  is_required: boolean; fine_amount: number;
  minimum_stay_minutes?: number;
  audience_type: 'all_students' | 'by_school';
  school_codes: string[];     // when by_school
  checkers: { profile_id: string; school: string }[];
  sessions: SessionInput[];   // at least one
}

// The legacy event-level columns are derived from the sessions: the overall
// range spans them and requires_time_out is true when any session is in/out.
function eventColumns(input: NewEventInput) {
  const opens = input.sessions.map((s) => s.checking_opens_at).sort();
  const closes = input.sessions.map((s) => s.checking_closes_at).sort();
  return {
    name: input.name, venue: input.venue, description: input.description,
    duration_type: input.duration_type,
    start_date: input.start_date, end_date: input.end_date,
    audience_type: input.audience_type,
    starts_at: opens[0], ends_at: closes[closes.length - 1],
    checking_opens_at: opens[0], checking_closes_at: closes[closes.length - 1],
    is_required: input.is_required,
    requires_time_out: input.sessions.some((s) => s.mode === 'in_out'),
    minimum_stay_minutes: input.minimum_stay_minutes ?? null,
    fine_amount: input.fine_amount,
  };
}

export async function createEvent(input: NewEventInput): Promise<string | null> {
  if (!supabase) return 'Backend not configured';
  const { data: session } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('events')
    .insert({ ...eventColumns(input), created_by: session.user?.id })
    .select('id').single();
  if (error) return error.message;
  return writeEventChildren(data.id, input, { replace: false });
}

export async function updateEvent(id: string, input: NewEventInput): Promise<string | null> {
  if (!supabase) return 'Backend not configured';
  const { error } = await supabase.from('events').update(eventColumns(input)).eq('id', id);
  if (error) return error.message;
  return writeEventChildren(id, input, { replace: true });
}

async function writeEventChildren(
  eventId: string, input: NewEventInput, { replace }: { replace: boolean },
): Promise<string | null> {
  if (!supabase) return 'Backend not configured';

  // Sessions: upsert the kept ones, delete the removed ones. A session that
  // already has attendance refuses deletion (FK) — surfaced as the error.
  if (replace) {
    const keptIds = input.sessions.map((s) => s.id).filter(Boolean) as string[];
    let del = supabase.from('event_sessions').delete().eq('event_id', eventId);
    if (keptIds.length) del = del.not('id', 'in', `(${keptIds.join(',')})`);
    const { error } = await del;
    if (error) {
      return error.code === '23503'
        ? 'A removed session already has attendance scans — it can’t be deleted.'
        : error.message;
    }
  }
  // PostgREST bulk writes need identical keys on every row, so existing
  // sessions (with id) and new ones (without) go in separate calls.
  const sessionRow = (s: SessionInput) => ({
    event_id: eventId, session_date: s.session_date,
    program: s.program.trim() || null, venue: s.venue.trim() || null,
    mode: s.mode, checking_opens_at: s.checking_opens_at,
    checking_closes_at: s.checking_closes_at, sort_order: s.sort_order,
  });
  const existing = input.sessions.filter((s) => s.id);
  const fresh = input.sessions.filter((s) => !s.id);
  if (existing.length) {
    const { error } = await supabase.from('event_sessions').upsert(
      existing.map((s) => ({ id: s.id, ...sessionRow(s) })), { onConflict: 'id' });
    if (error) return error.message;
  }
  if (fresh.length) {
    const { error } = await supabase.from('event_sessions').insert(fresh.map(sessionRow));
    if (error) return error.message;
  }

  // Audience schools (A4): simple replace.
  if (replace) {
    const { error } = await supabase.from('event_schools').delete().eq('event_id', eventId);
    if (error) return error.message;
  }
  if (input.audience_type === 'by_school' && input.school_codes.length) {
    const { error } = await supabase.from('event_schools')
      .insert(input.school_codes.map((code) => ({ event_id: eventId, school_code: code })));
    if (error) return error.message;
  }

  if (replace) {
    const { error } = await supabase.from('event_checkers').delete().eq('event_id', eventId);
    if (error) return error.message;
  }
  if (input.checkers.length) {
    const { error } = await supabase.from('event_checkers')
      .insert(input.checkers.map((c) => ({ ...c, event_id: eventId })));
    if (error) return error.message;
  }
  return null;
}

export interface EventForEdit {
  input: NewEventInput;
  checkerNames: Record<string, string>; // profile_id → display name
}

export async function loadEventForEdit(id: string): Promise<EventForEdit | null> {
  if (!supabase) return null;
  const [{ data: ev, error }, { data: sessions }, { data: schools }, { data: checkers }] =
    await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_sessions').select('*').eq('event_id', id)
        .order('session_date').order('sort_order'),
      supabase.from('event_schools').select('school_code').eq('event_id', id),
      supabase.from('event_checkers').select('profile_id, school, profiles(full_name)').eq('event_id', id),
    ]);
  if (error || !ev) return null;
  return {
    input: {
      name: ev.name, venue: ev.venue ?? '', description: ev.description ?? '',
      duration_type: ev.duration_type ?? 'single_day',
      start_date: ev.start_date, end_date: ev.end_date,
      is_required: ev.is_required,
      fine_amount: Number(ev.fine_amount ?? 0),
      minimum_stay_minutes: ev.minimum_stay_minutes ?? undefined,
      audience_type: ev.audience_type ?? 'all_students',
      school_codes: (schools ?? []).map((s: any) => s.school_code),
      checkers: (checkers ?? []).map((c: any) => ({ profile_id: c.profile_id, school: c.school })),
      sessions: (sessions ?? []).map((s: any) => ({
        id: s.id, session_date: s.session_date,
        program: s.program ?? '', venue: s.venue ?? '',
        mode: s.mode, checking_opens_at: s.checking_opens_at,
        checking_closes_at: s.checking_closes_at, sort_order: s.sort_order,
      })),
    },
    checkerNames: Object.fromEntries(
      (checkers ?? []).map((c: any) => [c.profile_id, c.profiles?.full_name ?? '—'])),
  };
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
  first_name: string; middle_name?: string | null; last_name: string;
  email: string; role: 'student' | 'checker' | 'event_maker';
  mode: 'invite' | 'temp_password';
  student_no?: string; school_id?: string;
  course?: string; year_level?: number; section?: string;
}

export async function provisionAccount(input: ProvisionInput):
  Promise<{ error?: string; temp_password?: string }> {
  if (!supabase) return { error: 'Backend not configured' };
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
// FEATURE_BATCH_2 A1/A2 format:
// student_no, first_name, middle_name, last_name, email, school, course,
// year_level, section — middle_name may be empty; school is required
// (code like SOC, or the full school name).
export const CSV_HEADER =
  'student_no,first_name,middle_name,last_name,email,school,course,year_level,section';

export interface CsvStudent {
  student_no: string; first_name: string; middle_name: string | null;
  last_name: string; email: string | null; school_id: string;
  course: string | null; year_level: number | null; section: string | null;
}

function schoolCodeOf(cell: string): string | null {
  const v = cell.trim();
  const byCode = SCHOOLS.find((s) => s.code.toLowerCase() === v.toLowerCase());
  if (byCode) return byCode.code;
  const byName = SCHOOLS.find((s) => s.name.toLowerCase() === v.toLowerCase());
  return byName ? byName.code : null;
}

export function parseStudentsCsv(text: string): { rows: CsvStudent[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], errors: ['empty file'] };
  // Header row is optional; detect it by a non-numeric first field.
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('student') || first.includes('name');
  if (hasHeader && !first.includes('first')) {
    return {
      rows: [],
      errors: [`old CSV format — the columns are now: ${CSV_HEADER}`],
    };
  }
  const rows: CsvStudent[] = [];
  for (const [i, line] of lines.slice(hasHeader ? 1 : 0).entries()) {
    const n = i + 1 + (hasHeader ? 1 : 0);
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 6 || !cells[0]) {
      errors.push(`line ${n}: expected columns ${CSV_HEADER}`);
      continue;
    }
    const [studentNo, firstName, middleName, lastName, email, school] = cells;
    if (!firstName || !lastName) {
      errors.push(`line ${n}: first_name and last_name are required (middle_name may be empty)`);
      continue;
    }
    const schoolCode = schoolCodeOf(school);
    if (!schoolCode) {
      errors.push(`line ${n}: unknown school “${school}” — use a code like ${SCHOOLS.map((s) => s.code).join('/')}`);
      continue;
    }
    rows.push({
      student_no: studentNo,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      email: email || null,
      school_id: schoolCode,
      course: cells[6] || null,
      year_level: cells[7] ? Number(cells[7]) || null : null,
      section: cells[8] || null,
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
      // Full date + time (UX §7 / FEATURE_BATCH_2 A7): "Jul 18, 8:04 AM"
      time: new Date(r.created_at).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      }),
      actor: r.actor?.full_name ?? 'system',
      action: r.action, actionTone: tone[r.action] ?? 'dark',
      record: `${r.table_name} · ${String(r.record_id).slice(0, 8)}`,
      table: r.table_name as string,
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

// ── master data (settings page) ─────────────────────────────────────
/** Distinct courses / year levels / sections actually present on the
 * active roster — real master data, not a hardcoded list. */
export async function loadRosterFacets():
  Promise<{ courses: string[]; years: number[]; sections: string[] } | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('students')
    .select('course, year_level, section').eq('active', true);
  if (!data) return null;
  const courses = [...new Set((data as any[]).map((s) => s.course).filter(Boolean))].sort();
  const years = [...new Set((data as any[]).map((s) => s.year_level).filter((y) => y != null))].sort();
  const sections = [...new Set((data as any[]).map((s) => s.section).filter(Boolean))].sort();
  return { courses, years: years as number[], sections };
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
