import { FormEvent, ReactNode, useRef, useState } from 'react';
import { PageHeader } from '../components/Shell';
import { ConfirmDialog, LoadError, useEscape } from '../components/ConfirmDialog';
import { AccountRow } from '../data/types';
import {
  useLoadedState, loadAccounts, provisionAccount, ProvisionInput,
  parseStudentsCsv, importStudents, resetPassword, resendInvite, setAccountActive,
} from '../data/api';

const GRID = '1.9fr .9fr .8fr 1fr 1.1fr';

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
    { kind: 'deactivate' | 'reset'; name: string; email: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: accounts, loading, error: loadFailed, retry } = useLoadedState(loadAccounts, [], [reload]);
  const rows = accounts.filter((a) => a.role === role);
  const countOf = (r: AccountRow['role']) => accounts.filter((a) => a.role === r).length;
  const statusCount = (s: AccountRow['status']) => accounts.filter((a) => a.status === s).length;

  const importCsv = async (file: File) => {
    const { rows: parsed, errors } = parseStudentsCsv(await file.text());
    if (!parsed.length) {
      setNotice(`Nothing imported — ${errors[0] ?? 'no valid rows'}`);
      return;
    }
    const err = await importStudents(parsed);
    setNotice(err
      ? `Import failed: ${err}`
      : `Imported ${parsed.length} students${errors.length ? ` (${errors.length} lines skipped)` : ''}`);
    setReload((n) => n + 1);
  };

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <span className="chip green" style={{ padding: '5px 11px', fontSize: 10 }}>Activated {statusCount('activated')}</span>
          <span className="chip blue" style={{ padding: '5px 11px', fontSize: 10 }}>Invited {statusCount('invited')}</span>
          <span className="chip orange" style={{ padding: '5px 11px', fontSize: 10 }}>Never logged in {statusCount('never')}</span>
        </div>
      </div>
      <div className="card" style={{ margin: '12px 22px 18px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 18px' }}>
          <div>NAME / EMAIL</div><div>STUDENT NO</div><div>COURSE</div><div>STATUS</div><div>ACTIONS</div>
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
              <div>{a.course}</div>
              <div><span className={STATUS_CHIP[a.status]} style={{ padding: '3px 10px' }}>{a.statusLabel}</span></div>
              <div style={{ opacity: busyEmail === a.email ? 0.5 : 1 }}>
                {a.status === 'activated' && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)' }}>
                    <button style={{ color: 'var(--student-deep)', fontWeight: 700 }} onClick={() => setConfirmAction({ kind: 'reset', name: a.name, email: a.email })}>Reset password</button>
                    {' · '}
                    <button style={{ color: 'var(--danger-deep)', fontWeight: 700 }} onClick={() => setConfirmAction({ kind: 'deactivate', name: a.name, email: a.email })}>Deactivate</button>
                  </span>
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
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)' }}>Roster only</span>
                  )
                )}
                {a.status === 'deactivated' && (
                  <button style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--checker-deep)' }} onClick={() => doSetActive(a.email, true)}>
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
          title={confirmAction.kind === 'deactivate'
            ? `Deactivate ${confirmAction.name}?`
            : `Reset password for ${confirmAction.name}?`}
          body={confirmAction.kind === 'deactivate'
            ? <>The account <b>{confirmAction.email}</b> loses access immediately (soft delete —
              history stays in the audit log). You can restore it later.</>
            : <>The current password for <b>{confirmAction.email}</b> stops working and a new
              temporary password is shown once, for you to hand over.</>}
          confirmLabel={confirmAction.kind === 'deactivate' ? 'Deactivate' : 'Reset password'}
          destructive={confirmAction.kind === 'deactivate'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const a = confirmAction;
            setConfirmAction(null);
            if (!a) return;
            if (a.kind === 'deactivate') doSetActive(a.email, false);
            else doReset(a.email);
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

// Modal backdrop that closes on Esc and backdrop click (UX §8).
function EscapableOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div
      onClick={onClose}
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
    full_name: '', email: '', mode: 'temp_password' as ProvisionInput['mode'],
    student_no: '', course: '', year_level: '', section: '',
  });
  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await provisionAccount({
      full_name: form.full_name, email: form.email, role, mode: form.mode,
      ...(role === 'student' ? {
        student_no: form.student_no, course: form.course,
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
              Share this temporary password with <b>{form.full_name}</b>. They must change it on first login.
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
            <div style={{ marginTop: 12 }}>
              <div className="field-label">Full name (Last, First)</div>
              <input className="input-box" style={input} required value={form.full_name} onChange={set('full_name')} placeholder="Dela Cruz, Juan Miguel" />
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
                  <div className="field-label">Course</div>
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
