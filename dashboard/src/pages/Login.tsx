import { useNavigate } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { hasBackend } from '../lib/supabase';

// Not in the design canvas — follows the 4c student-login pattern with the
// event-maker purple accent.
export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) { setError(err); return; }
    navigate('/dashboard');
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 26 }}>
      <div style={{ textAlign: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}assets/sg-logo.png`} alt="MVC CSG" style={{ width: 64, height: 64, borderRadius: '50%', boxShadow: '0 8px 24px rgba(35,42,49,.12)' }} />
        <div className="display" style={{ fontSize: 24, marginTop: 12 }}>CSG Events</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>Event maker dashboard · MVC Central Student Government</div>
      </div>
      <form
        onSubmit={submit}
        style={{ width: 360, background: 'var(--surface)', borderRadius: 20, boxShadow: '0 6px 24px rgba(35,42,49,.08)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div>
          <div className="field-label">School email</div>
          <input
            className="input-box" style={{ marginTop: 6, borderRadius: 13, padding: '11px 14px', fontWeight: 600 }}
            type="email" placeholder="r.uy@mvc.edu.ph" autoFocus required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="field-label">Password</div>
          <input
            className="input-box" style={{ marginTop: 6, borderRadius: 13, padding: '11px 14px' }}
            type="password" placeholder="••••••••" required={hasBackend}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div style={{ background: 'rgba(217,89,80,.1)', color: 'var(--danger-deep)', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, fontWeight: 600 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          className="pill-btn"
          disabled={busy}
          style={{ background: 'var(--maker)', color: '#fff', padding: 13, fontSize: 13.5, boxShadow: '0 8px 22px rgba(142,95,174,.35)', marginTop: 2, opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--maker-deep)' }}>Forgot password?</div>
      </form>
      <div style={{ width: 360, background: 'rgba(142,95,174,.08)', borderRadius: 14, padding: '12px 15px', fontSize: 11, color: 'var(--maker-deep)', lineHeight: 1.55, textAlign: 'center' }}>
        {hasBackend
          ? <>Event maker and super-admin accounts only. Accounts are provisioned by the SG — check your school email for an <b>activation link</b>.</>
          : <>Demo mode — no backend configured, any credentials work.</>}
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>v1.0 · S.Y. 2026–2027</div>
    </div>
  );
}
