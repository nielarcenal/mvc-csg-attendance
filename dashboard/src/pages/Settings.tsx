import { PageHeader } from '../components/Shell';
import { SCHOOLS } from '../data/mock';

const COURSE_CHIPS = [
  { label: 'BSIT', cls: 'chip blue' },
  { label: 'BSED', cls: 'chip green' },
  { label: 'BSBA', cls: 'chip purple' },
  { label: 'BSN', cls: 'chip orange' },
];

function AddChip() {
  return (
    <button style={{ border: '1.5px dashed #cfd6d2', color: 'var(--text-2)', borderRadius: 99, padding: '5px 13px', fontSize: 11, fontWeight: 700 }}>
      + Add
    </button>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader
        title="Settings & master data"
        subtitle="Super-admin only — every change here is audited"
        actions={<button className="pill-btn primary" style={{ padding: '9px 20px' }}>Save changes</button>}
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '2px 22px 18px', minHeight: 0, alignContent: 'start' }}>
        <div className="card" style={{ padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Courses</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COURSE_CHIPS.map((c) => (
              <span key={c.label} className={c.cls} style={{ padding: '5px 13px', fontSize: 11, cursor: 'pointer' }}>{c.label} ✕</span>
            ))}
            <AddChip />
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
            <div>
              <div className="field-label">Year levels</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>1 · 2 · 3 · 4</div>
            </div>
            <div>
              <div className="field-label">Sections</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>A · B · C</div>
            </div>
            <div>
              <div className="field-label">School year</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3, color: 'var(--checker-deep)' }}>2026–27 · active</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Schools</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SCHOOLS.map((s) => (
              <span key={s.code} title={s.name} style={{ background: 'var(--bg)', borderRadius: 99, padding: '5px 13px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {s.code} ✕
              </span>
            ))}
            <AddChip />
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 11, lineHeight: 1.5 }}>
            Checkers are assigned per school — the school tag rides on every scan record.
          </div>
        </div>

        <div className="card" style={{ padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Fines &amp; grace</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { title: 'Default fine — unexcused absence', sub: 'Events can override per-event', value: '₱ 50.00' },
              { title: 'Grace period after window close', sub: 'Scans inside grace skip the review queue', value: '0 min' },
              { title: 'Excuse filing deadline', sub: 'After the event ends', value: '3 days' },
            ].map((row) => (
              <div key={row.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{row.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{row.sub}</div>
                </div>
                <span className="input-box" style={{ width: 'auto', padding: '6px 12px', fontWeight: 800, fontSize: 12 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Notifications &amp; email</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Event reminders</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Push via FCM</div>
              </div>
              <span className="chip blue" style={{ padding: '5px 12px', fontSize: 10.5 }}>24h + 1h before</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Invite email template</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Activation link · expires 7 days</div>
              </div>
              <button style={{ fontSize: 11, fontWeight: 800, color: 'var(--student-deep)' }}>Edit →</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Absence alert template</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Sent when marked absent</div>
              </div>
              <button style={{ fontSize: 11, fontWeight: 800, color: 'var(--student-deep)' }}>Edit →</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
