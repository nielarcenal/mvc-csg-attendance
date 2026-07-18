import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Shell';
import { ConfirmDialog, LoadError } from '../components/ConfirmDialog';
import { EventRow, EventStatus } from '../data/types';
import { useLoadedState, loadEvents, generateFines } from '../data/api';

const STATUS_CHIP: Record<EventStatus, { cls: string; label: string }> = {
  live: { cls: 'chip green', label: '● Live' },
  upcoming: { cls: 'chip blue', label: 'Upcoming' },
  draft: { cls: 'chip orange', label: 'Draft' },
  closed: { cls: 'chip gray', label: 'Closed' },
};

function sub(e: EventRow) {
  const parts = [e.venue, e.required ? 'required' : 'optional'];
  if (e.rsvps) parts.push(`${e.rsvps} RSVPs`);
  if (e.timeOut) parts.push('time-out');
  return parts.join(' · ');
}

export default function Events() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmFines, setConfirmFines] = useState<EventRow | null>(null);
  const { data: events, loading, error, retry } = useLoadedState(loadEvents, []);

  const closeOut = async (e: EventRow) => {
    setBusyId(e.id);
    const res = await generateFines(e.id);
    setBusyId(null);
    setNotice(res.error
      ? `Fine generation failed: ${res.error}`
      : `${e.name}: ${res.count} fine${res.count === 1 ? '' : 's'} generated for unexcused absentees`);
  };
  const total = events.length;
  const count = (s: EventStatus[]) => events.filter((e) => s.includes(e.status)).length;
  const filters = [
    { key: 'all', label: `All · ${total}` },
    { key: 'live', label: `● Live · ${count(['live'])}`, color: 'var(--checker-deep)' },
    { key: 'upcoming', label: `Upcoming · ${count(['upcoming', 'draft'])}` },
    { key: 'closed', label: `Closed · ${count(['closed'])}` },
  ];
  const rows = events.filter((e) => {
    if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'all') return true;
    if (filter === 'upcoming') return e.status === 'upcoming' || e.status === 'draft';
    return e.status === filter;
  });

  return (
    <>
      <PageHeader
        title="Events"
        subtitle={`S.Y. 2026–27 · ${total} events`}
        actions={
          <button className="pill-btn primary" onClick={() => navigate('/events/new')}>+ New event</button>
        }
      />
      <div style={{ display: 'flex', gap: 8, padding: '2px 22px 0', alignItems: 'center', flex: 'none' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            className={`filter-pill${filter === f.key ? ' active' : ''}`}
            style={filter !== f.key && f.color ? { color: f.color } : undefined}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <input
          className="filter-pill"
          style={{ marginLeft: 'auto', width: 170, border: 'none', outline: 'none', color: 'var(--ink)' }}
          placeholder="Search events…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {notice && (
        <div style={{ margin: '10px 22px 0', padding: '9px 14px', background: 'rgba(226,145,63,.12)', color: 'var(--alert-deep)', borderRadius: 10, fontSize: 11.5, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ fontWeight: 800, color: 'inherit' }}>✕</button>
        </div>
      )}
      <div className="card" style={{ margin: '12px 22px 18px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr 1fr .8fr 1.1fr .8fr .4fr', gap: 8, padding: '11px 18px' }}>
          <div>EVENT</div><div>DATE</div><div>CHECK-IN WINDOW</div><div>CHECKERS</div><div>ATTENDANCE</div><div>STATUS</div><div />
        </div>
        {rows.map((e) => (
          <div
            key={e.id}
            className="table-row"
            style={{
              display: 'grid', gridTemplateColumns: '1.7fr .9fr 1fr .8fr 1.1fr .8fr .4fr', gap: 8,
              padding: '11px 18px', cursor: e.status === 'live' ? 'pointer' : 'default',
              background: e.status === 'live' ? 'rgba(53,164,99,.05)' : undefined,
            }}
            onClick={e.status === 'live' ? () => navigate('/live') : undefined}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{e.name}</div>
              <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>{sub(e)}</div>
            </div>
            <div style={{ fontWeight: 600 }}>{e.date}</div>
            <div style={{ color: 'var(--text-2)' }}>{e.window}</div>
            <div style={e.checkers === 0 ? { color: 'var(--alert-deep)', fontWeight: 700 } : undefined}>
              {e.checkers === 0 ? '0 — assign!' : `${e.checkers} assigned`}
            </div>
            {e.attendance != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--hairline-2)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${e.attendance}%`, height: '100%', borderRadius: 4,
                      background: e.status === 'live' ? 'var(--checker)' : 'var(--muted)',
                    }}
                  />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: e.status === 'live' ? 'var(--checker-deep)' : 'var(--text-2)' }}>
                  {e.attendance}%
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>—</div>
            )}
            <div><span className={STATUS_CHIP[e.status].cls}>{STATUS_CHIP[e.status].label}</span></div>
            <div>
              {e.status === 'closed' && e.required ? (
                <button
                  className="pill-btn"
                  disabled={busyId === e.id}
                  style={{ border: '1.5px solid var(--alert)', color: 'var(--alert-deep)', padding: '3px 9px', fontSize: 9.5, opacity: busyId === e.id ? 0.5 : 1 }}
                  onClick={(ev) => { ev.stopPropagation(); setConfirmFines(e); }}
                >
                  {busyId === e.id ? '…' : 'Generate fines'}
                </button>
              ) : (
                <span style={{ color: 'var(--muted)', fontWeight: 800 }}>⋯</span>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          error && total === 0 ? <LoadError retry={retry} what="events" />
          : (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              {loading ? 'Loading events…'
                : total === 0 ? 'No events yet — create the first one with “+ New event”.'
                  : 'No events match the current filter.'}
            </div>
          )
        )}
        <div className="table-foot">
          <span>Clicking a live event opens the live attendance view</span>
          <span>1–{rows.length} of {total}</span>
        </div>
      </div>
      {confirmFines && (
        <ConfirmDialog
          title={`Generate fines for ${confirmFines.name}?`}
          body={<>Every active student without a valid or approved check-in and without an
            approved excuse gets a ₱ fine at this event’s rate. Approved excuses filed later
            will waive their fines automatically.</>}
          confirmLabel="Generate fines"
          destructive
          onCancel={() => setConfirmFines(null)}
          onConfirm={() => { const e = confirmFines; setConfirmFines(null); if (e) closeOut(e); }}
        />
      )}
    </>
  );
}
