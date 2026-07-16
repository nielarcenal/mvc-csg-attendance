import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Shell';
import { SCHOOLS } from '../data/mock';
import {
  useLoaded, loadCheckerProfiles, createEvent, hasBackend, initialsOf, colorOf,
} from '../data/api';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`toggle ${on ? 'on' : 'off'}`} onClick={() => onChange(!on)}>
      <div className="knob" />
    </div>
  );
}

interface Assigned { profile_id: string; name: string; school: string }

// Default schedule: next week, 6–9 PM, check-in 5:30–6:30 (mirrors the mock).
function defaultAt(days: number, h: number, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EventCreate() {
  const navigate = useNavigate();
  const [optional, setOptional] = useState(true);
  const [timeOut, setTimeOut] = useState(true);
  const [recurring, setRecurring] = useState(false);
  const [name, setName] = useState('Acquaintance Party');
  const [venue, setVenue] = useState('Covered Court');
  const [description, setDescription] = useState('Welcome party for freshmen — SG-hosted.');
  const [startsAt, setStartsAt] = useState(defaultAt(8, 18));
  const [endsAt, setEndsAt] = useState(defaultAt(8, 21));
  const [opensAt, setOpensAt] = useState(defaultAt(8, 17, 30));
  const [closesAt, setClosesAt] = useState(defaultAt(8, 18, 30));
  const [minStay, setMinStay] = useState('60');
  const [fine, setFine] = useState('50.00');
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickChecker, setPickChecker] = useState('');
  const [pickSchool, setPickSchool] = useState('SOC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkers = useLoaded(loadCheckerProfiles, hasBackend ? [] : [
    { id: 'demo-jr', full_name: 'Ramos, Joel V.' },
    { id: 'demo-lt', full_name: 'Tan, Liza M.' },
  ]);

  const addChecker = () => {
    const c = checkers.find((c) => c.id === pickChecker);
    if (!c || assigned.some((a) => a.profile_id === c.id)) { setPicking(false); return; }
    setAssigned([...assigned, { profile_id: c.id, name: c.full_name, school: pickSchool }]);
    setPicking(false);
  };

  const publish = async () => {
    setError(null);
    if (!name.trim()) { setError('Event name is required.'); return; }
    setBusy(true);
    const err = await createEvent({
      name: name.trim(), venue: venue.trim(), description: description.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      checking_opens_at: new Date(opensAt).toISOString(),
      checking_closes_at: new Date(closesAt).toISOString(),
      is_required: !optional, requires_time_out: timeOut,
      minimum_stay_minutes: timeOut ? parseInt(minStay, 10) || undefined : undefined,
      fine_amount: Number(fine) || 0,
      checkers: assigned.map(({ profile_id, school }) => ({ profile_id, school })),
    });
    setBusy(false);
    if (err) { setError(err); return; }
    navigate('/events');
  };

  const purpleField = {
    marginTop: 5,
    border: '1.5px solid #c9b3d8',
    borderRadius: 11,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(142,95,174,.05)',
    width: '100%',
    outline: 'none',
  } as const;

  return (
    <>
      <PageHeader
        crumb={<>Events / <span style={{ color: 'var(--maker-deep)' }}>New</span></>}
        title="New event"
        actions={
          <>
            {error && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-deep)' }}>{error}</span>}
            <button className="pill-btn ghost">Save as template</button>
            <button className="pill-btn primary" onClick={publish} disabled={busy} style={{ opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Publishing…' : 'Publish event'}
            </button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '2px 22px 18px', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Details</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1.4 }}>
                <div className="field-label">Event name</div>
                <input className="input-box" style={{ marginTop: 5, fontWeight: 700 }} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="field-label">Venue</div>
                <input className="input-box" style={{ marginTop: 5 }} value={venue} onChange={(e) => setVenue(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 11, alignItems: 'flex-end' }}>
              <div style={{ flex: 1.4 }}>
                <div className="field-label">Description</div>
                <input className="input-box" style={{ marginTop: 5, color: 'var(--text-2)', fontSize: 12 }} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="field-label">Attendance</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                  <button
                    className="pill-btn"
                    onClick={() => setOptional(false)}
                    style={!optional
                      ? { background: 'var(--maker)', color: '#fff', padding: '8px 15px', fontSize: 11 }
                      : { border: '1.5px solid var(--hairline)', color: 'var(--text-2)', padding: '8px 15px', fontSize: 11, fontWeight: 700 }}
                  >
                    Required{!optional && ' ✓'}
                  </button>
                  <button
                    className="pill-btn"
                    onClick={() => setOptional(true)}
                    style={optional
                      ? { background: 'var(--maker)', color: '#fff', padding: '8px 15px', fontSize: 11 }
                      : { border: '1.5px solid var(--hairline)', color: 'var(--text-2)', padding: '8px 15px', fontSize: 11, fontWeight: 700 }}
                  >
                    Optional + RSVP{optional && ' ✓'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Schedule &amp; checking window</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <div className="field-label">Starts</div>
                <input type="datetime-local" className="input-box" style={{ marginTop: 5, fontWeight: 700, fontSize: 12 }} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <div className="field-label">Ends</div>
                <input type="datetime-local" className="input-box" style={{ marginTop: 5, fontWeight: 700, fontSize: 12 }} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
              <div>
                <div className="field-label" style={{ color: 'var(--maker-deep)' }}>Check-in opens</div>
                <input type="datetime-local" style={purpleField} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
              </div>
              <div>
                <div className="field-label" style={{ color: 'var(--maker-deep)' }}>Check-in closes</div>
                <input type="datetime-local" style={purpleField} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 11, background: 'rgba(226,145,63,.08)', borderRadius: 11, padding: '10px 13px', fontSize: 11, color: '#8a5f2a', lineHeight: 1.5 }}>
              Scans after the window closes are still accepted but land in the <b>review queue</b>. Status is computed from the scan
              time — offline scans made in the window stay valid even if they sync late.
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Rules &amp; fines</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>Requires time-out</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-2)' }}>Students must also scan when leaving</div>
                </div>
                <Toggle on={timeOut} onChange={setTimeOut} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>Minimum stay</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-2)' }}>Timed-out earlier → marked “left early”</div>
                </div>
                <input className="input-box" style={{ width: 80, padding: '7px 12px', fontWeight: 700, fontSize: 12 }} value={minStay} onChange={(e) => setMinStay(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>Fine for unexcused absence</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-2)' }}>Auto-generated when the event closes, waived if an excuse is approved</div>
                </div>
                <input className="input-box" style={{ width: 90, padding: '7px 12px', fontWeight: 800, fontSize: 12 }} value={fine} onChange={(e) => setFine(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: 352, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
              <div className="card-title">Checkers</div>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>{assigned.length} assigned</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {assigned.map((c) => (
                <div key={c.profile_id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid var(--hairline)', borderRadius: 12, padding: '9px 12px' }}>
                  <span className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: colorOf(c.name) }}>{initialsOf(c.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)' }}>
                      {c.school} · {SCHOOLS.find((s) => s.code === c.school)?.name.replace('School of ', '').replace('School of ', '') ?? ''}
                    </div>
                  </div>
                  <button
                    style={{ color: 'var(--danger-deep)', fontSize: 12, fontWeight: 700 }}
                    onClick={() => setAssigned(assigned.filter((a) => a.profile_id !== c.profile_id))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {picking ? (
                <div style={{ border: '1.5px solid var(--maker)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <select className="input-box" style={{ padding: '8px 10px', fontSize: 11.5, fontWeight: 700 }} value={pickChecker} onChange={(e) => setPickChecker(e.target.value)}>
                    <option value="">Select checker…</option>
                    {checkers.map((c) => (
                      <option key={c.id} value={c.id} disabled={assigned.some((a) => a.profile_id === c.id)}>{c.full_name}</option>
                    ))}
                  </select>
                  <select className="input-box" style={{ padding: '8px 10px', fontSize: 11.5, fontWeight: 700 }} value={pickSchool} onChange={(e) => setPickSchool(e.target.value)}>
                    {SCHOOLS.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="pill-btn primary" style={{ flex: 1, padding: '7px 0', fontSize: 11 }} onClick={addChecker}>Add</button>
                    <button className="pill-btn ghost" style={{ padding: '7px 14px', fontSize: 11 }} onClick={() => setPicking(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  style={{ border: '1.5px dashed #cfd6d2', borderRadius: 12, padding: 10, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}
                  onClick={() => setPicking(true)}
                >
                  + Assign checker &amp; school
                </button>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
              Checkers can only scan for events they’re assigned to — enforced at the database level.
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Roster</div>
            <div style={{ background: 'rgba(53,164,99,.08)', borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: 'var(--checker)' }}>✓</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--checker-deep)' }}>
                  {hasBackend ? 'Full active roster' : '460 students on roster'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-2)' }}>
                  {hasBackend ? 'All active students are covered by every event' : 'Reused from “SG General Assembly”'}
                </div>
              </div>
            </div>
            <button style={{ marginTop: 9, border: '1.5px dashed #cfd6d2', borderRadius: 12, padding: 12, textAlign: 'center', width: '100%' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>↑ Import CSV instead</div>
              <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 2 }}>student no · name · email · course · year</div>
            </button>
          </div>

          <div className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Recurring event</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-2)' }}>Repeat monthly with same settings</div>
            </div>
            <Toggle on={recurring} onChange={setRecurring} />
          </div>
        </div>
      </div>
    </>
  );
}
