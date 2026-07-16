import { useEffect, useState } from 'react';
import { LIVE_ROWS, Method } from '../data/mock';
import { LiveView, loadLiveView, subscribeAttendance, downloadCsv, hasBackend } from '../data/api';

const METHOD_CHIP: Record<Method, string> = { QR: 'chip blue', RFID: 'chip purple', Manual: 'chip orange' };

const GRID = '1.6fr .58fr .66fr .76fr .48fr 1fr .82fr';

// Demo fallback mirroring the design mock.
const DEMO_VIEW: LiveView = {
  event: {
    id: 'demo', name: 'SG General Assembly',
    sub: 'MVC Gymnasium · Jul 15, 2026 · check-in 7:00–8:15 AM',
    windowLine: '7:00 – 8:15 AM', closed: true, closesLabel: '8:15',
  },
  present: 351, roster: 460, rate: 76, forReview: 5,
  rows: LIVE_ROWS, lastSync: '8:22 AM',
};

export default function LiveAttendance() {
  const [manualOnly, setManualOnly] = useState(false);
  const [view, setView] = useState<LiveView>(DEMO_VIEW);

  useEffect(() => {
    if (!hasBackend) return;
    let alive = true;
    const refresh = () => loadLiveView().then((v) => { if (alive && v) setView(v); });
    refresh();
    const unsub = subscribeAttendance(refresh);
    return () => { alive = false; unsub(); };
  }, []);

  const rows = manualOnly ? view.rows.filter((r) => r.method === 'Manual') : view.rows;
  const pct = view.roster ? Math.round((view.present / view.roster) * 100) : 0;

  return (
    <>
      <div style={{ padding: '16px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 'none' }}>
        <div>
          <div className="display" style={{ fontSize: 21 }}>
            {view.event.name}
            {!hasBackend && <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, fontFamily: 'var(--font-ui)' }}> · 1st Sem Opening</span>}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{view.event.sub}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!view.event.closed ? (
            <span className="chip green" style={{ padding: '6px 13px', fontSize: 11 }}>
              <span style={{ animation: 'pulse 1.6s infinite' }}>●</span> Live
            </span>
          ) : (
            <>
              <span className="chip green" style={{ padding: '6px 13px', fontSize: 11 }}>
                <span style={{ animation: 'pulse 1.6s infinite' }}>●</span> Live
              </span>
              <span className="chip orange" style={{ padding: '6px 13px', fontSize: 11 }}>
                Window closed {view.event.closesLabel} — late scans go to review
              </span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '16px 22px 4px', flex: 'none' }}>
        <div className="card" style={{ flex: 1.2, padding: '14px 16px' }}>
          <div className="section-label" style={{ fontSize: 9.5 }}>PRESENT</div>
          <div className="display" style={{ fontSize: 26, marginTop: 2, color: 'var(--checker-deep)' }}>
            {view.present} <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>/ {view.roster}</span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--hairline-2)', marginTop: 9, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'var(--checker)' }} />
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
          <div className="section-label" style={{ fontSize: 9.5 }}>RATE</div>
          <div className="display" style={{ fontSize: 26, marginTop: 2 }}>{view.rate}%</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 9 }}>
            {hasBackend ? 'of active roster' : '↑ 5 pts vs last event'}
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
          <div className="section-label" style={{ fontSize: 9.5 }}>FOR REVIEW</div>
          <div className="display" style={{ fontSize: 26, marginTop: 2, color: 'var(--alert-deep)' }}>{view.forReview}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 9 }}>late scans with notes</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
          <div className="section-label" style={{ fontSize: 9.5 }}>PENDING SYNC</div>
          <div className="display" style={{ fontSize: 26, marginTop: 2, color: 'var(--student-deep)' }}>{hasBackend ? '—' : 12}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 9 }}>
            {hasBackend ? 'reported by devices on sync' : '2 devices offline'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 22px 0', alignItems: 'center', flex: 'none' }}>
        <button className="filter-pill" style={{ color: 'var(--ink)' }}>Method: All ▾</button>
        <button
          className="filter-pill"
          style={manualOnly
            ? { background: 'var(--alert)', color: '#fff', fontWeight: 800 }
            : { background: 'rgba(226,145,63,.14)', color: 'var(--alert-deep)', fontWeight: 800, boxShadow: 'none' }}
          onClick={() => setManualOnly(!manualOnly)}
        >
          Manual only
        </button>
        <button className="filter-pill" style={{ color: 'var(--ink)' }}>Checker: All ▾</button>
        <button className="filter-pill" style={{ color: 'var(--ink)' }}>Status: All ▾</button>
        <button
          className="filter-pill"
          style={{ color: 'var(--maker-deep)', fontWeight: 800 }}
          onClick={() => downloadCsv(
            `${view.event.name.replace(/\W+/g, '-').toLowerCase()}-attendance.csv`,
            ['Student', 'Time-in', 'Method', 'Checker', 'School', 'Status', 'Note'],
            rows.map((r) => [r.name, r.timeIn, r.method, r.checker, r.school,
              r.status === 'valid' ? 'Valid' : (r.reviewLabel ?? 'For review'), r.note ?? '']),
          )}
        >
          ↓ Export CSV
        </button>
        <input className="filter-pill" style={{ marginLeft: 'auto', width: 170, border: 'none', outline: 'none' }} placeholder="Search students…" />
      </div>

      <div className="card" style={{ margin: '12px 22px 18px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 18px' }}>
          <div>STUDENT</div><div>TIME-IN</div><div>METHOD</div><div>CHECKER</div><div>SCHOOL</div><div>SCANNED → SYNCED</div><div>STATUS</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {rows.map((r) => (
            <div
              key={r.name + r.timeIn}
              className="table-row"
              style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '10px 18px', background: r.highlight ? 'rgba(226,145,63,.07)' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 9.5, background: r.color }}>{r.initials}</span>
                <div>
                  <div style={{ fontWeight: r.highlight ? 700 : 600 }}>{r.name}</div>
                  {r.note && (
                    <div style={{ fontSize: 9, color: r.noteTone === 'orange' ? 'var(--alert-deep)' : 'var(--muted)', fontWeight: r.noteTone === 'orange' ? 700 : 400 }}>
                      {r.note}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontWeight: 600 }}>{r.timeIn}</div>
              <div><span className={METHOD_CHIP[r.method]} style={{ padding: '3px 8px' }}>{r.method}</span></div>
              <div>{r.checker}</div>
              <div style={{ fontWeight: 600 }}>{r.school}</div>
              <div style={{ fontSize: 10.5, color: r.syncOffline ? 'var(--student-deep)' : 'var(--text-2)', fontWeight: r.syncOffline ? 700 : 400 }}>{r.sync}</div>
              <div>
                <span className={r.status === 'valid' ? 'chip green' : 'chip orange'} style={{ padding: '4px 9px' }}>
                  {r.status === 'valid' ? 'Valid' : r.reviewLabel}
                </span>
              </div>
            </div>
          ))}
          {hasBackend && rows.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              No scans yet — they appear here in realtime as checkers scan.
            </div>
          )}
        </div>
        <div className="table-foot">
          <span>Showing latest {rows.length} of {view.present}</span>
          <span>Last scan synced {view.lastSync}</span>
        </div>
      </div>
    </>
  );
}
