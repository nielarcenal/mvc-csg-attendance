import { FormEvent, ReactNode, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/Shell';
import { ConfirmDialog, LoadError, useEscape } from '../components/ConfirmDialog';
import { AccountRow, SCHOOLS, StudentDetail } from '../data/types';
import {
  useLoadedState, loadAccounts, provisionAccount, ProvisionInput,
  parseStudentsCsv, importStudents, resetPassword, resendInvite, setAccountActive,
  updateStudent, regenerateQrToken, downloadCsv, CSV_HEADER,
} from '../data/api';

const GRID = '1.9fr .8fr .6fr .85fr .85fr 1.3fr';

// FEATURE_BATCH_2 §B: students sortable by school, year level, course and
// name A–Z; the choice lives in the URL so it survives refresh/share.
type SortKey = 'name' | 'school' | 'year' | 'course';
const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name A–Z', school: 'School', year: 'Year level', course: 'Course',
};

function compareRows(a: AccountRow, b: AccountRow, key: SortKey): number {
  const byName = () => a.sortName.localeCompare(b.sortName);
  switch (key) {
    case 'school': return a.school.localeCompare(b.school) || byName();
    case 'year': return (a.yearLevel ?? 99) - (b.yearLevel ?? 99) || byName();
    case 'course': return (a.course || '~').localeCompare(b.course || '~') || byName();
    default: return byName();
  }
}

const STATUS_CHIP: Record<AccountRow['status'], string> = {
  activated: 'chip green',
  invited: 'chip blue',
  never: 'chip orange',
  deactivated: 'chip gray',
};

export default function Accounts() {
  const [role, setRole] = useState<AccountRow['role']>('student');
  const [modalRole, setModalRole] = useState<'student' | 'checker' | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<{ email: string; pw: string } | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  // §4: crucial account actions confirm first, naming the person.
  const [confirmAction, setConfirmAction] = useState<
    { kind: 'deactivate' | 'reset' | 'restore'; name: string; email: string } | null>(null);
  const [editing, setEditing] = useState<{ detail: StudentDetail; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: accounts, loading, error: loadFailed, retry } =
    useLoadedState(loadAccounts, [], [reload], { auto: true });

  const [params, setParams] = useSearchParams();
  const sortKey = (params.get('sort') ?? 'name') as SortKey;
  const sortDir = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const setSort = (key: SortKey, dir?: 'asc' | 'desc') => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      const nextDir = dir ?? (key === sortKey && sortDir === 'asc' ? 'desc' : 'asc');
      if (key === 'name' && nextDir === 'asc') { next.delete('sort'); next.delete('dir'); }
      else { next.set('sort', key); next.set('dir', nextDir); }
      return next;
    }, { replace: true });
  };

  const rows = accounts
    .filter((a) => a.role === role)
    .sort((a, b) => (sortDir === 'asc' ? 1 : -1) * compareRows(a, b, sortKey));
  const countOf = (r: AccountRow['role']) => accounts.filter((a) => a.role === r).length;
  const statusCount = (s: AccountRow['status']) => accounts.filter((a) => a.status === s).length;
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  const importCsv = async (file: File) => {
    const { rows: parsed, errors } = parseStudentsCsv(await file.text());
    if (!parsed.length) {
      setNotice(`Nothing imported — ${errors[0] ?? 'no valid rows'}`);
      return;
    }
    const err = await importStudents(parsed);
    setNotice(err
      ? `Import failed: ${err}`
      : `Imported ${parsed.length} students${errors.length ? ` — ${errors.length} line${errors.length === 1 ? '' : 's'} skipped (first: ${errors[0]})` : ''}`);
    setReload((n) => n + 1);
  };

  // Header + one example row so nobody has to guess the new column order.
  const downloadTemplate = () => downloadCsv(
    'students-template.csv',
    CSV_HEADER.split(','),
    [['2026-00001', 'Juan Miguel', '', 'Dela Cruz', 'j.delacruz@mvc.edu.ph', 'SOC', 'BSIT', '3', 'A']],
  );

  const doReset = async (email: string) => {
    setBusyEmail(email);
    const res = await resetPassword(email);
    setBusyEmail(null);
    if (res.error) { setNotice(`Reset failed: ${res.error}`); return; }
    if (res.temp_password) setTempPw({ email, pw: res.temp_password });
  };

  const doResend = async (email: string) => {
    setBusyEmail(email);
    const res = await resendInvite(email);
    setBusyEmail(null);
    setNotice(res.error ? `Resend failed: ${res.error}` : `Recovery email sent to ${email}`);
  };

  const doSetActive = async (email: string, active: boolean) => {
    setBusyEmail(email);
    const res = await setAccountActive(email, active);
    setBusyEmail(null);
    if (res.error) { setNotice(`Update failed: ${res.error}`); return; }
    setNotice(active ? `${email} restored` : `${email} deactivated (soft delete)`);
    setReload((n) => n + 1);
  };

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Credentials go out as email activation links — created server-side, never plaintext passwords"
        actions={
          <>
            <button className="pill-btn" style={{ padding: '8px 14px', fontSize: 11.5 }} onClick={retry}>↻ Refresh</button>
            <button className="pill-btn ghost" onClick={() => setModalRole('checker')}>+ Invite checker</button>
            <button className="pill-btn ghost" onClick={() => setModalRole('student')}>+ Add student</button>
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = '';
              }}
            />
            <button className="pill-btn primary" style={{ padding: '9px 20px' }} onClick={() => fileRef.current?.click()}>
              ↑ Import students CSV
            </button>
            <button
              className="pill-btn ghost"
              title={`Columns: ${CSV_HEADER}`}
              style={{ padding: '9px 14px', fontSize: 11 }}
              onClick={downloadTemplate}
            >
              CSV template
            </button>
          </>
        }
      />
      {notice && (
        <div style={{ margin: '0 22px', padding: '9px 14px', background: 'rgba(63,155,216,.1)', color: 'var(--student-deep)', borderRadius: 10, fontSize: 11.5, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ fontWeight: 800, color: 'inherit' }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '2px 22px 0', alignItems: 'center', flex: 'none' }}>
        <button className={`filter-pill${role === 'student' ? ' active' : ''}`} onClick={() => setRole('student')}>
          Students · {countOf('student')}
        </button>
        <button className={`filter-pill${role === 'checker' ? ' active' : ''}`} onClick={() => setRole('checker')}>
          Checkers · {countOf('checker')}
        </button>
        <button className={`filter-pill${role === 'maker' ? ' active' : ''}`} onClick={() => setRole('maker')}>
          Event makers · {countOf('maker')}
        </button>
        {role === 'student' && (
          <>
            <select
              aria-label="Sort students"
              style={{ padding: '7px 12px', borderRadius: 99, border: '1px solid var(--hairline)', background: 'var(--surface)', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}
              value={sortKey}
              onChange={(e) => setSort(e.target.value as SortKey, sortDir)}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>Sort: {SORT_LABELS[k]}</option>
              ))}
            </select>
            <button
              className="filter-pill"
              title={sortDir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
              onClick={() => setSort(sortKey)}
              style={{ padding: '7px 11px' }}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <span className="chip green" style={{ padding: '5px 11px', fontSize: 10 }}>Activated {statusCount('activated')}</span>
          <span className="chip blue" style={{ padding: '5px 11px', fontSize: 10 }}>Invited {statusCount('invited')}</span>
          <span className="chip orange" style={{ padding: '5px 11px', fontSize: 10 }}>Never logged in {statusCount('never')}</span>
        </div>
      </div>
      <div className="card" style={{ margin: '12px 22px 18px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 18px' }}>
          <div
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            title="Sort by name"
            onClick={() => setSort('name')}
            onKeyDown={(e) => e.key === 'Enter' && setSort('name')}
          >
            NAME / EMAIL{arrow('name')}
          </div>
          <div>STUDENT NO</div>
          <div
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            title="Sort by school"
            onClick={() => setSort('school')}
            onKeyDown={(e) => e.key === 'Enter' && setSort('school')}
          >
            SCHOOL{arrow('school')}
          </div>
          <div>STATUS</div><div>LAST LOGIN</div><div>ACTIONS</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {rows.map((a) => (
            <div
              key={a.email + a.studentNo}
              className="table-row"
              style={{
                display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '10px 18px',
                opacity: a.status === 'deactivated' ? 0.55 : 1,
                background: a.status === 'invited' ? 'rgba(63,155,216,.04)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="avatar" style={{ width: 27, height: 27, fontSize: 9.5, background: a.color }}>{a.initials}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>{a.email}</div>
                </div>
              </div>
              <div style={{ fontWeight: 600 }}>{a.studentNo}</div>
              <div style={{ fontWeight: 700 }}>
                {a.school === '—' ? <span style={{ color: 'var(--muted)' }}>—</span>
                  : <span title={SCHOOLS.find((s) => s.code === a.school)?.name}>{a.school}</span>}
              </div>
              <div><span className={STATUS_CHIP[a.status]} style={{ padding: '3px 10px' }}>{a.statusLabel}</span></div>
              {/* A8: real auth.users.last_sign_in_at via the edge function */}
              <div style={{ fontWeight: 600, color: a.lastLogin === '—' ? 'var(--muted)' : 'var(--text-2)' }}>
                {a.lastLogin}
              </div>
              <div style={{ opacity: busyEmail === a.email ? 0.5 : 1, fontSize: 10.5, fontWeight: 700, color: 'var(--muted)' }}>
                {a.student && (
                  <>
                    <button style={{ color: 'var(--maker-deep)', fontWeight: 700 }} onClick={() => setEditing({ detail: a.student!, name: a.name })}>Edit</button>
                    {(a.status !== 'never' || a.statusLabel !== 'No account') && ' · '}
                  </>
                )}
                {a.status === 'activated' && (
                  <>
                    <button style={{ color: 'var(--student-deep)', fontWeight: 700 }} onClick={() => setConfirmAction({ kind: 'reset', name: a.name, email: a.email })}>Reset password</button>
                    {' · '}
                    <button style={{ color: 'var(--danger-deep)', fontWeight: 700 }} onClick={() => setConfirmAction({ kind: 'deactivate', name: a.name, email: a.email })}>Deactivate</button>
                  </>
                )}
                {(a.status === 'invited' || a.status === 'never') && (
                  a.email !== '—' && a.statusLabel !== 'No account' ? (
                    <button
                      className="pill-btn"
                      style={{ border: '1.5px solid var(--student)', color: 'var(--student-deep)', padding: '4px 11px', fontSize: 10 }}
                      onClick={() => doResend(a.email)}
                    >
                      Resend invite
                    </button>
                  ) : (
                    !a.student && <span>Roster only</span>
                  )
                )}
                {a.status === 'deactivated' && (
                  <button style={{ color: 'var(--checker-deep)', fontWeight: 700 }} onClick={() => setConfirmAction({ kind: 'restore', name: a.name, email: a.email })}>
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {rows.length === 0 && (
          loadFailed ? <LoadError retry={retry} what="accounts" />
          : (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              {loading ? 'Loading accounts…' : 'No accounts in this group yet.'}
            </div>
          )
        )}
        <div className="table-foot">
          <span>Deactivations are soft deletes — history stays in the audit log</span>
          <span>1–{rows.length} of {countOf(role)}</span>
        </div>
      </div>
      {modalRole && (
        <ProvisionModal
          role={modalRole}
          onClose={() => setModalRole(null)}
          onDone={() => { setModalRole(null); setReload((n) => n + 1); }}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          title={{
            deactivate: `Deactivate ${confirmAction.name}?`,
            reset: `Reset password for ${confirmAction.name}?`,
            restore: `Reactivate ${confirmAction.name}?`,
          }[confirmAction.kind]}
          body={{
            deactivate: <>The account <b>{confirmAction.email}</b> loses access immediately (soft
              delete — history stays in the audit log). You can restore it later.</>,
            reset: <>The current password for <b>{confirmAction.email}</b> stops working and a new
              temporary password is shown once, for you to hand over.</>,
            restore: <>The account <b>{confirmAction.email}</b> gets access again with its
              existing password.</>,
          }[confirmAction.kind]}
          confirmLabel={{ deactivate: 'Deactivate', reset: 'Reset password', restore: 'Reactivate' }[confirmAction.kind]}
          destructive={confirmAction.kind === 'deactivate'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const a = confirmAction;
            setConfirmAction(null);
            if (!a) return;
            if (a.kind === 'deactivate') doSetActive(a.email, false);
            else if (a.kind === 'restore') doSetActive(a.email, true);
            else doReset(a.email);
          }}
        />
      )}
      {editing && (
        <EditStudentModal
          detail={editing.detail}
          name={editing.name}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice('Student details saved');
            setReload((n) => n + 1);
          }}
        />
      )}
      {tempPw && (
        <EscapableOverlay onClose={() => setTempPw(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 380, borderRadius: 18, padding: 22 }}>
            <div className="display" style={{ fontSize: 17 }}>Password reset</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
              New temporary password for <b>{tempPw.email}</b>. They must change it on first login.
            </div>
            <div style={{ marginTop: 12, background: 'var(--bg)', borderRadius: 12, padding: '13px 15px', fontWeight: 800, fontSize: 15, letterSpacing: 0.5, textAlign: 'center' }}>
              {tempPw.pw}
            </div>
            <button className="pill-btn primary" style={{ width: '100%', padding: 11, marginTop: 14 }} onClick={() => setTempPw(null)}>Done</button>
          </div>
        </EscapableOverlay>
      )}
    </>
  );
}

// Admin edit of student details (FEATURE_BATCH_2 §B) — names, school,
// course, year, section, email. Saving asks for confirmation; the write is
// audited by the students trigger. Course lives here (detail view), not in
// the table (A2).
function EditStudentModal({ detail, name, onClose, onSaved }: {
  detail: StudentDetail; name: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    first_name: detail.first_name,
    middle_name: detail.middle_name ?? '',
    last_name: detail.last_name,
    email: detail.email ?? '',
    school_id: detail.school_id,
    course: detail.course ?? '',
    year_level: detail.year_level == null ? '' : String(detail.year_level),
    section: detail.section ?? '',
    qr_mode: detail.qr_mode,
    qr_active: detail.qr_active,
    qr_expires_at: detail.qr_expires_at ? detail.qr_expires_at.slice(0, 10) : '',
  });
  const [confirming, setConfirming] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const qrChanged = form.qr_mode !== detail.qr_mode
    || form.qr_active !== detail.qr_active
    || (form.qr_expires_at || null) !== (detail.qr_expires_at ? detail.qr_expires_at.slice(0, 10) : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setConfirming(true);
  };

  const save = async () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    const err = await updateStudent({
      id: detail.id,
      profile_id: detail.profile_id,
      student_no: detail.student_no,
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      school_id: form.school_id,
      course: form.course.trim() || null,
      year_level: form.year_level ? Number(form.year_level) || null : null,
      section: form.section.trim() || null,
      qr_mode: form.qr_mode,
      qr_active: form.qr_active,
      qr_expires_at: form.qr_mode === 'static' && form.qr_expires_at
        ? new Date(`${form.qr_expires_at}T23:59:59`).toISOString() : null,
    });
    setBusy(false);
    if (err) { setError(err); return; }
    onSaved();
  };

  const regenerate = async () => {
    setConfirmingRegen(false);
    setBusy(true);
    setError(null);
    const err = await regenerateQrToken(detail.id);
    setBusy(false);
    if (err) { setError(err); return; }
    setNotice('New QR token issued — reprint the card; the old printout stops scanning once checkers refresh their roster.');
  };

  const input = { marginTop: 5, borderRadius: 11, padding: '9px 12px', fontWeight: 600, width: '100%' } as const;

  return (
    <EscapableOverlay onClose={() => (confirming ? setConfirming(false) : onClose())}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 440, borderRadius: 18, padding: 22 }}>
        <form onSubmit={submit}>
          <div className="display" style={{ fontSize: 17 }}>Edit student</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>
            {detail.student_no} — changes are written to the audit log
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr 1.1fr', gap: 10, marginTop: 12 }}>
            <div>
              <div className="field-label">First name</div>
              <input className="input-box" style={input} required value={form.first_name} onChange={set('first_name')} />
            </div>
            <div>
              <div className="field-label">Middle (optional)</div>
              <input className="input-box" style={input} value={form.middle_name} onChange={set('middle_name')} />
            </div>
            <div>
              <div className="field-label">Last name</div>
              <input className="input-box" style={input} required value={form.last_name} onChange={set('last_name')} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <div className="field-label">School</div>
              <select className="input-box" style={input} required value={form.school_id} onChange={set('school_id')}>
                <option value="">Select school…</option>
                {SCHOOLS.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
              </select>
            </div>
            <div>
              <div className="field-label">Email</div>
              <input className="input-box" style={input} type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <div className="field-label">Course (optional)</div>
              <input className="input-box" style={input} value={form.course} onChange={set('course')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="field-label">Year</div>
                <input className="input-box" style={input} type="number" min={1} max={6} value={form.year_level} onChange={set('year_level')} />
              </div>
              <div>
                <div className="field-label">Section</div>
                <input className="input-box" style={input} value={form.section} onChange={set('section')} />
              </div>
            </div>
          </div>
          {detail.profile_id && (
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Name changes also update the linked account’s display name. The sign-in email stays
              unchanged — use Reset password / re-invite flows for account access.
            </div>
          )}

          {/* QR v2 admin controls (A5): mode, expiry, deactivate, regenerate */}
          <div style={{ marginTop: 14, borderTop: '1px solid var(--hairline-2)', paddingTop: 12 }}>
            <div className="field-label" style={{ marginBottom: 8 }}>QR CODE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="field-label">Mode</div>
                <select className="input-box" style={input} value={form.qr_mode} onChange={set('qr_mode')}>
                  <option value="dynamic">Dynamic (app-generated)</option>
                  <option value="static">Static (printed card)</option>
                </select>
              </div>
              <div>
                <div className="field-label">Status</div>
                <select
                  className="input-box" style={input}
                  value={form.qr_active ? 'active' : 'off'}
                  onChange={(e) => setForm((f) => ({ ...f, qr_active: e.target.value === 'active' }))}
                >
                  <option value="active">Active</option>
                  <option value="off">Deactivated</option>
                </select>
              </div>
              {form.qr_mode === 'static' && (
                <div>
                  <div className="field-label">Static expiry (empty = never)</div>
                  <input className="input-box" style={input} type="date" value={form.qr_expires_at} onChange={set('qr_expires_at')} />
                </div>
              )}
              <div style={{ alignSelf: 'end' }}>
                <button
                  type="button"
                  className="pill-btn"
                  style={{ border: '1.5px solid var(--danger)', color: 'var(--danger-deep)', padding: '8px 14px', fontSize: 10.5, fontWeight: 700, width: '100%' }}
                  onClick={() => setConfirmingRegen(true)}
                >
                  Regenerate static token
                </button>
              </div>
            </div>
            {qrChanged && (
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--alert-deep)', fontWeight: 600, lineHeight: 1.5 }}>
                QR changes take effect on the student’s next app refresh and on the checkers’ next
                roster download.
              </div>
            )}
          </div>
          {notice && (
            <div style={{ marginTop: 10, background: 'rgba(53,164,99,.1)', color: 'var(--checker-deep)', borderRadius: 10, padding: '9px 12px', fontSize: 11, fontWeight: 600, lineHeight: 1.5 }}>
              {notice}
            </div>
          )}
          {error && (
            <div style={{ marginTop: 10, background: 'rgba(217,89,80,.1)', color: 'var(--danger-deep)', borderRadius: 10, padding: '9px 12px', fontSize: 11, fontWeight: 600 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
            <button type="submit" className="pill-btn primary" disabled={busy} style={{ flex: 1, padding: 11, opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="pill-btn ghost" onClick={onClose} style={{ padding: '11px 18px' }}>Cancel</button>
          </div>
        </form>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Save changes to ${name}?`}
          body={qrChanged
            ? 'This includes QR changes (mode, status or expiry) — the student’s current code may stop scanning. Everything is audited.'
            : 'The student’s roster record is updated everywhere — rosters, reports and the apps. The change is audited.'}
          confirmLabel="Save changes"
          destructive={qrChanged && !form.qr_active}
          onCancel={() => setConfirming(false)}
          onConfirm={save}
        />
      )}
      {confirmingRegen && (
        <ConfirmDialog
          title={`Regenerate QR token for ${name}?`}
          body="A new static token is issued immediately. Any printed card with the old token stops scanning once checkers refresh their roster — reprint from the Reports page."
          confirmLabel="Regenerate"
          destructive
          onCancel={() => setConfirmingRegen(false)}
          onConfirm={regenerate}
        />
      )}
    </EscapableOverlay>
  );
}

// Modal backdrop: closes on Esc only. Background clicks are swallowed so
// nothing behind the barrier (header included) can react (§B modal rule).
function EscapableOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(35,42,49,.4)', display: 'grid', placeItems: 'center', zIndex: 40 }}
    >
      {children}
    </div>
  );
}

// Single-form manual account creation (spec amendment #2). Calls the
// provision-account edge function — the service key stays server-side.
function ProvisionModal({ role, onClose, onDone }: {
  role: 'student' | 'checker'; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', mode: 'temp_password' as ProvisionInput['mode'],
    student_no: '', school_id: '', course: '', year_level: '', section: '',
  });
  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (role === 'student' && !form.school_id) {
      setError('School is required for students.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await provisionAccount({
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      email: form.email, role, mode: form.mode,
      ...(role === 'student' ? {
        student_no: form.student_no, school_id: form.school_id,
        course: form.course,
        year_level: form.year_level ? Number(form.year_level) : undefined,
        section: form.section || undefined,
      } : {}),
    });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    if (form.mode === 'temp_password' && res.temp_password) { setTempPw(res.temp_password); return; }
    onDone();
  };

  const input = { marginTop: 5, borderRadius: 11, padding: '9px 12px', fontWeight: 600, width: '100%' } as const;

  return (
    <EscapableOverlay onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 400, borderRadius: 18, padding: 22 }}>
        {tempPw ? (
          <>
            <div className="display" style={{ fontSize: 17 }}>Account created</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
              Share this temporary password with <b>{displayName || form.email}</b>. They must change it on first login.
            </div>
            <div style={{ marginTop: 12, background: 'var(--bg)', borderRadius: 12, padding: '13px 15px', fontWeight: 800, fontSize: 15, letterSpacing: 0.5, textAlign: 'center' }}>
              {tempPw}
            </div>
            <button className="pill-btn primary" style={{ width: '100%', padding: 11, marginTop: 14 }} onClick={onDone}>Done</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="display" style={{ fontSize: 17 }}>
              {role === 'student' ? 'Add student account' : 'Invite checker'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr 1.1fr', gap: 10, marginTop: 12 }}>
              <div>
                <div className="field-label">First name</div>
                <input className="input-box" style={input} required value={form.first_name} onChange={set('first_name')} placeholder="Juan Miguel" />
              </div>
              <div>
                <div className="field-label">Middle (optional)</div>
                <input className="input-box" style={input} value={form.middle_name} onChange={set('middle_name')} placeholder="—" />
              </div>
              <div>
                <div className="field-label">Last name</div>
                <input className="input-box" style={input} required value={form.last_name} onChange={set('last_name')} placeholder="Dela Cruz" />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="field-label">School email</div>
              <input className="input-box" style={input} type="email" required value={form.email} onChange={set('email')} placeholder="j.delacruz@mvc.edu.ph" />
            </div>
            {role === 'student' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <div className="field-label">Student no</div>
                  <input className="input-box" style={input} required value={form.student_no} onChange={set('student_no')} placeholder="2023-01417" />
                </div>
                <div>
                  <div className="field-label">School</div>
                  <select className="input-box" style={input} required value={form.school_id} onChange={set('school_id')}>
                    <option value="">Select school…</option>
                    {SCHOOLS.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="field-label">Course (optional)</div>
                  <input className="input-box" style={input} value={form.course} onChange={set('course')} placeholder="BSIT" />
                </div>
                <div>
                  <div className="field-label">Year level</div>
                  <input className="input-box" style={input} type="number" min={1} max={6} value={form.year_level} onChange={set('year_level')} placeholder="3" />
                </div>
                <div>
                  <div className="field-label">Section</div>
                  <input className="input-box" style={input} value={form.section} onChange={set('section')} placeholder="A" />
                </div>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <div className="field-label">Credential delivery</div>
              <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
                <button type="button" className={`filter-pill${form.mode === 'temp_password' ? ' active' : ''}`} onClick={() => setForm((f) => ({ ...f, mode: 'temp_password' }))}>
                  Temp password
                </button>
                <button type="button" className={`filter-pill${form.mode === 'invite' ? ' active' : ''}`} onClick={() => setForm((f) => ({ ...f, mode: 'invite' }))}>
                  Email invite link
                </button>
              </div>
            </div>
            {error && (
              <div style={{ marginTop: 10, background: 'rgba(217,89,80,.1)', color: 'var(--danger-deep)', borderRadius: 10, padding: '9px 12px', fontSize: 11, fontWeight: 600 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
              <button type="submit" className="pill-btn primary" disabled={busy} style={{ flex: 1, padding: 11, opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Creating…' : 'Create account'}
              </button>
              <button type="button" className="pill-btn ghost" onClick={onClose} style={{ padding: '11px 18px' }}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </EscapableOverlay>
  );
}
