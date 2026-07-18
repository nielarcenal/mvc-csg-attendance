import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Shell';
import { SCHOOLS } from '../data/types';
import { loadSettings, saveSetting, loadRosterFacets, useLoaded } from '../data/api';

const COURSE_CLS = ['chip blue', 'chip green', 'chip purple', 'chip orange'];

export default function Settings() {
  const [fine, setFine] = useState('50.00');
  const [grace, setGrace] = useState('0');
  const [deadline, setDeadline] = useState('3');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const facets = useLoaded(loadRosterFacets, null);

  useEffect(() => {
    loadSettings().then((s) => {
      if (!s) return;
      const strip = (v?: string) => (v ?? '').replace(/^"|"$/g, '');
      if (s.default_fine_amount) setFine(strip(s.default_fine_amount));
      if (s.grace_period_minutes) setGrace(strip(s.grace_period_minutes));
      if (s.excuse_deadline_days) setDeadline(strip(s.excuse_deadline_days));
    });
  }, []);

  const save = async () => {
    setBusy(true);
    setNotice(null);
    const errs = (await Promise.all([
      saveSetting('default_fine_amount', fine),
      saveSetting('grace_period_minutes', grace),
      saveSetting('excuse_deadline_days', deadline),
    ])).filter(Boolean);
    setBusy(false);
    setNotice(errs.length
      ? `Save failed: ${errs[0]} (super-admin only)`
      : 'Settings saved — grace period now applies to new scans.');
  };

  const numBox = {
    width: 90, padding: '6px 12px', fontWeight: 800, fontSize: 12, textAlign: 'right',
  } as const;

  return (
    <>
      <PageHeader
        title="Settings & master data"
        subtitle="Super-admin only — every change here is audited"
        actions={
          <>
            {notice && <span style={{ fontSize: 11, fontWeight: 700, color: notice.startsWith('Save failed') ? 'var(--danger-deep)' : 'var(--checker-deep)' }}>{notice}</span>}
            <button className="pill-btn primary" style={{ padding: '9px 20px', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '2px 22px 18px', minHeight: 0, alignContent: 'start' }}>
        <div className="card" style={{ padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Courses on the roster</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(facets?.courses ?? []).map((c, i) => (
              <span key={c} className={COURSE_CLS[i % COURSE_CLS.length]} style={{ padding: '5px 13px', fontSize: 11 }}>{c}</span>
            ))}
            {facets && facets.courses.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>No students imported yet.</span>
            )}
            {!facets && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</span>}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
            <div>
              <div className="field-label">Year levels</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>
                {facets && facets.years.length > 0 ? facets.years.join(' · ') : '—'}
              </div>
            </div>
            <div>
              <div className="field-label">Sections</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>
                {facets && facets.sections.length > 0 ? facets.sections.join(' · ') : '—'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 11, lineHeight: 1.5 }}>
            Derived from the active roster — manage them by importing or editing students on the Accounts page.
          </div>
        </div>

        <div className="card" style={{ padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Schools</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SCHOOLS.map((s) => (
              <span key={s.code} title={s.name} style={{ background: 'var(--bg)', borderRadius: 99, padding: '5px 13px', fontSize: 11, fontWeight: 700 }}>
                {s.code}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 11, lineHeight: 1.5 }}>
            Checkers are assigned per school — the school tag rides on every scan record.
          </div>
        </div>

        <div className="card" style={{ padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Fines &amp; grace</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Default fine — unexcused absence (₱)</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Events can override per-event</div>
              </div>
              <input className="input-box" style={numBox} value={fine} onChange={(e) => setFine(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Grace period after window close (min)</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Scans inside grace skip the review queue</div>
              </div>
              <input className="input-box" style={numBox} value={grace} onChange={(e) => setGrace(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Excuse filing deadline (days)</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>After the event ends</div>
              </div>
              <input className="input-box" style={numBox} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
