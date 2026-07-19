import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/Shell';
import { LoadError } from '../components/ConfirmDialog';
import { SCHOOLS } from '../data/types';
import {
  useLoaded, loadCheckerProfiles, createEvent, updateEvent, loadEventForEdit,
  initialsOf, colorOf, DurationType, SessionMode, NewEventInput, SessionInput,
} from '../data/api';

interface Assigned { profile_id: string; name: string; school: string }

// Local session row: date + wall-clock times; ISO is composed on save.
interface SessionDraft {
  key: number;
  id?: string;
  session_date: string; // YYYY-MM-DD
  program: string;
  venue: string;
  mode: SessionMode;
  opens: string;  // HH:MM
  closes: string; // HH:MM
}

const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
};
const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();
const isoToTime = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const dayLabel = (date: string) =>
  new Date(`${date}T12:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

/** Every date in [start, end], capped at 31 days for sanity. */
function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  for (let i = 0; i < 31 && d <= end; i++) { out.push(d); d = addDays(d, 1); }
  return out;
}

let nextKey = 1;
const defaultSession = (date: string, venue: string): SessionDraft => ({
  key: nextKey++, session_date: date, program: '', venue,
  mode: 'in_only', opens: '07:30', closes: '08:30',
});

export default function EventCreate() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const editing = Boolean(editId);

  const [optional, setOptional] = useState(false);
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [durationType, setDurationType] = useState<DurationType>('single_day');
  const [startDate, setStartDate] = useState(() => ymd(new Date(Date.now() + 8 * 86400_000)));
  const [endDate, setEndDate] = useState(startDate);
  const [sessions, setSessions] = useState<SessionDraft[]>(
    () => [defaultSession(ymd(new Date(Date.now() + 8 * 86400_000)), '')]);
  const [audienceType, setAudienceType] = useState<'all_students' | 'by_school'>('all_students');
  const [schoolCodes, setSchoolCodes] = useState<string[]>([]);
  const [minStay, setMinStay] = useState('60');
  const [fine, setFine] = useState('50.00');
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickChecker, setPickChecker] = useState('');
  const [pickSchool, setPickSchool] = useState('SOC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(editing);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const checkers = useLoaded(loadCheckerProfiles, []);

  // Edit mode: prefill from the live event.
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    setLoadingEdit(true);
    setLoadFailed(false);
    loadEventForEdit(editId).then((loaded) => {
      if (!alive) return;
      if (!loaded) { setLoadFailed(true); setLoadingEdit(false); return; }
      const ev = loaded.input;
      setName(ev.name); setVenue(ev.venue); setDescription(ev.description);
      setOptional(!ev.is_required);
      setDurationType(ev.duration_type);
      setStartDate(ev.start_date); setEndDate(ev.end_date);
      setAudienceType(ev.audience_type); setSchoolCodes(ev.school_codes);
      setFine(ev.fine_amount.toFixed(2));
      setMinStay(String(ev.minimum_stay_minutes ?? 60));
      setAssigned(ev.checkers.map((c) => ({
        profile_id: c.profile_id, school: c.school,
        name: loaded.checkerNames[c.profile_id] ?? '—',
      })));
      setSessions(ev.sessions.map((s) => ({
        key: nextKey++, id: s.id, session_date: s.session_date,
        program: s.program, venue: s.venue, mode: s.mode,
        opens: isoToTime(s.checking_opens_at), closes: isoToTime(s.checking_closes_at),
      })));
      setLoadingEdit(false);
    }).catch(() => { if (alive) { setLoadFailed(true); setLoadingEdit(false); } });
    return () => { alive = false; };
  }, [editId, loadAttempt]);

  // Duration rules: 1 day pins end=start; 1 week pins end=start+6.
  const effectiveEnd = durationType === 'single_day' ? startDate
    : durationType === 'one_week' ? addDays(startDate, 6)
      : (endDate >= startDate ? endDate : startDate);
  const days = useMemo(() => dayRange(startDate, effectiveEnd), [startDate, effectiveEnd]);

  // Keep the session list in step with the day range: drop out-of-range
  // sessions (server rejects if they already have scans), seed empty days.
  useEffect(() => {
    if (loadingEdit) return;
    setSessions((prev) => {
      const kept = prev.filter((s) => days.includes(s.session_date));
      const missing = days.filter((d) => !kept.some((s) => s.session_date === d));
      if (!missing.length && kept.length === prev.length) return prev;
      return [...kept, ...missing.map((d) => defaultSession(d, venue))]
        .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.key - b.key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(','), loadingEdit]);

  const setSession = (key: number, patch: Partial<SessionDraft>) =>
    setSessions((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const addChecker = () => {
    const c = checkers.find((c) => c.id === pickChecker);
    if (!c || assigned.some((a) => a.profile_id === c.id)) { setPicking(false); return; }
    setAssigned([...assigned, { profile_id: c.id, name: c.full_name, school: pickSchool }]);
    setPicking(false);
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError('Event name is required.'); return; }
    if (!sessions.length) { setError('The event needs at least one checking session.'); return; }
    for (const s of sessions) {
      if (s.closes <= s.opens) {
        setError(`Session on ${dayLabel(s.session_date)}: check-in must close after it opens.`);
        return;
      }
    }
    if (audienceType === 'by_school' && schoolCodes.length === 0) {
      setError('Pick at least one school, or switch the audience to all students.');
      return;
    }
    const input: NewEventInput = {
      name: name.trim(), venue: venue.trim(), description: description.trim(),
      duration_type: durationType,
      start_date: startDate, end_date: effectiveEnd,
      is_required: !optional,
      fine_amount: Number(fine) || 0,
      minimum_stay_minutes: sessions.some((s) => s.mode === 'in_out')
        ? parseInt(minStay, 10) || undefined : undefined,
      audience_type: audienceType,
      school_codes: audienceType === 'by_school' ? schoolCodes : [],
      checkers: assigned.map(({ profile_id, school }) => ({ profile_id, school })),
      sessions: sessions.map<SessionInput>((s, i) => ({
        id: s.id, session_date: s.session_date,
        program: s.program, venue: s.venue || venue,
        mode: s.mode,
        checking_opens_at: toIso(s.session_date, s.opens),
        checking_closes_at: toIso(s.session_date, s.closes),
        sort_order: i,
      })),
    };
    setBusy(true);
    const err = editing ? await updateEvent(editId!, input) : await createEvent(input);
    setBusy(false);
    if (err) { setError(err); return; }
    navigate('/events');
  };

  const purpleField = {
    border: '1.5px solid #c9b3d8',
    borderRadius: 9,
    padding: '7px 9px',
    fontSize: 11.5,
    fontWeight: 700,
    background: 'rgba(142,95,174,.05)',
    outline: 'none',
  } as const;

  const segBtn = (active: boolean) => (active
    ? { background: 'var(--maker)', color: '#fff', padding: '8px 15px', fontSize: 11 }
    : { border: '1.5px solid var(--hairline)', color: 'var(--text-2)', padding: '8px 15px', fontSize: 11, fontWeight: 700 as const });

  if (editing && loadFailed) {
    return (
      <>
        <PageHeader crumb="Events / Edit" title="Edit event" />
        <LoadError retry={() => setLoadAttempt((n) => n + 1)} what="this event" />
      </>
    );
  }
  if (editing && loadingEdit) {
    return (
      <>
        <PageHeader crumb="Events / Edit" title="Edit event" />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>Loading event…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumb={<>Events / <span style={{ color: 'var(--maker-deep)' }}>{editing ? `${name || 'Edit'} / Edit` : 'New'}</span></>}
        title={editing ? 'Edit event' : 'New event'}
        actions={
          <>
            {error && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-deep)', maxWidth: 420 }}>{error}</span>}
            <button className="pill-btn primary" onClick={save} disabled={busy} style={{ opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish event'}
            </button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '2px 22px 18px', minHeight: 0, overflow: 'auto' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px', flex: 'none' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Details</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1.4 }}>
                <div className="field-label">Event name</div>
                <input className="input-box" style={{ marginTop: 5, fontWeight: 700 }} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="field-label">Default venue</div>
                <input className="input-box" style={{ marginTop: 5 }} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Used for sessions without their own" />
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
                  <button className="pill-btn" onClick={() => setOptional(false)} style={segBtn(!optional)}>
                    Required{!optional && ' ✓'}
                  </button>
                  <button className="pill-btn" onClick={() => setOptional(true)} style={segBtn(optional)}>
                    Optional + RSVP{optional && ' ✓'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px', flex: 'none' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Duration</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <div className="field-label">Length</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                  {([['single_day', '1 day'], ['one_week', '1 week'], ['custom', 'Custom range']] as [DurationType, string][]).map(([key, label]) => (
                    <button key={key} className="pill-btn" style={segBtn(durationType === key)} onClick={() => setDurationType(key)}>
                      {label}{durationType === key && ' ✓'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="field-label">{durationType === 'custom' ? 'From' : 'Date'}</div>
                <input type="date" className="input-box" style={{ marginTop: 5, fontWeight: 700, fontSize: 12 }} value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
              </div>
              {durationType === 'custom' && (
                <div>
                  <div className="field-label">To</div>
                  <input type="date" className="input-box" style={{ marginTop: 5, fontWeight: 700, fontSize: 12 }} min={startDate} value={effectiveEnd} onChange={(e) => e.target.value && setEndDate(e.target.value)} />
                </div>
              )}
              {durationType === 'one_week' && (
                <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, paddingBottom: 8 }}>
                  through {dayLabel(effectiveEnd)}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px', flex: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11 }}>
              <div className="card-title">Checking sessions</div>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>
                {sessions.length} session{sessions.length === 1 ? '' : 's'} · {days.length} day{days.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {days.map((day, di) => {
                const daySessions = sessions.filter((s) => s.session_date === day);
                return (
                  <div key={day}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--maker-deep)' }}>
                        DAY {di + 1} · {dayLabel(day).toUpperCase()}
                      </div>
                      <button
                        className="pill-btn"
                        style={{ border: '1.5px dashed #cfd6d2', color: 'var(--text-2)', padding: '3px 11px', fontSize: 10, fontWeight: 700 }}
                        onClick={() => setSessions((prev) => [...prev, defaultSession(day, venue)]
                          .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.key - b.key))}
                      >
                        + Add session
                      </button>
                    </div>
                    {daySessions.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 2px 2px' }}>
                        No sessions this day — students can’t be scanned on it.
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {daySessions.map((s) => (
                        <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr .62fr .62fr auto', gap: 7, alignItems: 'end', border: '1.5px solid var(--hairline)', borderRadius: 12, padding: '9px 11px' }}>
                          <div>
                            <div className="field-label" style={{ fontSize: 8.5 }}>Program</div>
                            <input className="input-box" style={{ marginTop: 3, padding: '7px 9px', fontSize: 11.5, fontWeight: 700 }} placeholder="e.g. Opening Ceremony" value={s.program} onChange={(e) => setSession(s.key, { program: e.target.value })} />
                          </div>
                          <div>
                            <div className="field-label" style={{ fontSize: 8.5 }}>Venue</div>
                            <input className="input-box" style={{ marginTop: 3, padding: '7px 9px', fontSize: 11.5 }} placeholder={venue || 'Venue'} value={s.venue} onChange={(e) => setSession(s.key, { venue: e.target.value })} />
                          </div>
                          <div>
                            <div className="field-label" style={{ fontSize: 8.5 }}>Mode</div>
                            <select className="input-box" style={{ marginTop: 3, padding: '7px 9px', fontSize: 11.5, fontWeight: 700 }} value={s.mode} onChange={(e) => setSession(s.key, { mode: e.target.value as SessionMode })}>
                              <option value="in_only">Check-in only</option>
                              <option value="in_out">Check-in &amp; out</option>
                            </select>
                          </div>
                          <div>
                            <div className="field-label" style={{ fontSize: 8.5, color: 'var(--maker-deep)' }}>Opens</div>
                            <input type="time" style={{ ...purpleField, marginTop: 3, width: '100%' }} value={s.opens} onChange={(e) => setSession(s.key, { opens: e.target.value })} />
                          </div>
                          <div>
                            <div className="field-label" style={{ fontSize: 8.5, color: 'var(--maker-deep)' }}>Closes</div>
                            <input type="time" style={{ ...purpleField, marginTop: 3, width: '100%' }} value={s.closes} onChange={(e) => setSession(s.key, { closes: e.target.value })} />
                          </div>
                          <button
                            title="Remove session"
                            aria-label="Remove session"
                            style={{ color: 'var(--danger-deep)', fontSize: 13, fontWeight: 700, padding: '8px 6px' }}
                            onClick={() => setSessions((prev) => prev.filter((x) => x.key !== s.key))}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 11, background: 'rgba(226,145,63,.08)', borderRadius: 11, padding: '10px 13px', fontSize: 11, color: '#8a5f2a', lineHeight: 1.5 }}>
              Scans after a session’s window closes are still accepted but land in the <b>review queue</b>. Status is
              computed per session from the scan time — offline scans made in the window stay valid even if they sync late.
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px', flex: 'none' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Rules &amp; fines</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {sessions.some((s) => s.mode === 'in_out') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>Minimum stay (min)</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-2)' }}>For check-in &amp; out sessions — timed-out earlier → “left early”</div>
                  </div>
                  <input className="input-box" style={{ width: 80, padding: '7px 12px', fontWeight: 700, fontSize: 12 }} value={minStay} onChange={(e) => setMinStay(e.target.value)} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>Fine for unexcused absence</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-2)' }}>Absent in any session counts as absent; approved excuses waive the fine</div>
                </div>
                <input className="input-box" style={{ width: 90, padding: '7px 12px', fontWeight: 800, fontSize: 12 }} value={fine} onChange={(e) => setFine(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: 352, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px', flex: 'none' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Audience</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="pill-btn" style={segBtn(audienceType === 'all_students')} onClick={() => setAudienceType('all_students')}>
                All enrolled students{audienceType === 'all_students' && ' ✓'}
              </button>
              <button className="pill-btn" style={segBtn(audienceType === 'by_school')} onClick={() => setAudienceType('by_school')}>
                By school{audienceType === 'by_school' && ' ✓'}
              </button>
            </div>
            {audienceType === 'by_school' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {SCHOOLS.map((s) => {
                  const on = schoolCodes.includes(s.code);
                  return (
                    <button
                      key={s.code}
                      title={s.name}
                      className="pill-btn"
                      onClick={() => setSchoolCodes((prev) => (on ? prev.filter((c) => c !== s.code) : [...prev, s.code]))}
                      style={on
                        ? { background: 'var(--dark-card)', color: '#fff', padding: '5px 12px', fontSize: 10.5 }
                        : { background: 'var(--bg)', color: 'var(--text-2)', padding: '5px 12px', fontSize: 10.5, fontWeight: 700 }}
                    >
                      {s.code}{on && ' ✓'}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Every active student is on the roster, in absentee lists and fines.
              </div>
            )}
            {audienceType === 'by_school' && (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Rosters, absentee lists, fines and the checker cache only include students of the selected school{schoolCodes.length === 1 ? '' : 's'}.
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '16px 18px', flex: 'none' }}>
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
                      {c.school} · {SCHOOLS.find((s) => s.code === c.school)?.name.replace('School of ', '') ?? ''}
                    </div>
                  </div>
                  <button
                    title="Remove checker"
                    aria-label="Remove checker"
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
        </div>
      </div>
    </>
  );
}
