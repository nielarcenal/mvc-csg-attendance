import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Method } from '../data/types';
import { LoadError } from '../components/ConfirmDialog';
import { LiveView, loadLiveView, subscribeAttendance, downloadCsv } from '../data/api';

const METHOD_CHIP: Record<Method, string> = { QR: 'chip blue', RFID: 'chip purple', Manual: 'chip orange' };

const GRID = '1.6fr .58fr .66fr .76fr .48fr 1fr .82fr';

const selectStyle = {
  padding: '7px 12px', borderRadius: 99, border: '1px solid var(--hairline)',
  background: 'var(--surface)', fontSize: 11, fontWeight: 700, color: 'var(--ink)',
} as const;

export default function LiveAttendance() {
  const [view, setView] = useState<LiveView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Filters live in the URL so refresh/share keeps state (UX §8 — this is
  // the attendance detail sheet the standard names explicitly).
  const [params, setParams] = useSearchParams();
  const method = (params.get('method') ?? 'all') as 'all' | Method;
  const checker = params.get('checker') ?? 'all';
  const status = (params.get('status') ?? 'all') as 'all' | 'valid' | 'review';
  const query = params.get('q') ?? '';
  const setParam = useCallback((key: string, value: string) => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (value === 'all' || value === '') next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    let alive = true;
    const refresh = () => loadLiveView()
      .then((v) => { if (alive) { setView(v); setLoading(false); setFailed(false); } })
      .catch(() => { if (alive) { setLoading(false); setFailed(true); } });
    refresh();
    const unsub = subscribeAttendance(refresh);
    return () => { alive = false; unsub(); };
  }, [attempt]);

  const checkers = useMemo(
    () => [...new Set((view?.rows ?? []).map((r) => r.checker))].sort(),
    [view],
  );
  const rows = (view?.rows ?? []).filter((r) => {
    if (method !== 'all' && r.method !== method) return false;
    if (checker !== 'all' && r.checker !== checker) return false;
    if (status !== 'all' && r.status !== status) return false;
    if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const pct = view && view.roster ? Math.round((view.present / view.roster) * 100) : 0;

  if (!view) {
    if (failed) {
      return (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <LoadError retry={() => { setLoading(true); setAttempt((n) => n + 1); }} what="live attendance" />
        </div>
      );
    }
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
        {loading ? 'Loading live attendance…' : 'No events yet — create one to see live attendance here.'}
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: '16px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 'none' }}>
        <div>
          <div className="display" style={{ fontSize: 21 }}>{view.event.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{view.event.sub}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!view.event.closed ? (
            <span className="chip green" style={{ padding: '6px 13px', fontSize: 11 }}>
              <span style={{ animation: 'pulse 1.6s infinite' }}>●</span> Live
            </span>
          ) : (
            <span className="chip orange" style={{ padding: '6px 13px', fontSize: 11 }}>
              Window closed {view.event.closesLabel} — late scans go to review
            </span>
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
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 9 }}>of active roster</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
          <div className="section-label" style={{ fontSize: 9.5 }}>FOR REVIEW</div>
          <div className="display" style={{ fontSize: 26, marginTop: 2, color: 'var(--alert-deep)' }}>{view.forReview}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 9 }}>late scans with notes</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
          <div className="section-label" style={{ fontSize: 9.5 }}>LAST SYNC</div>
          <div className="display" style={{ fontSize: 26, marginTop: 2, color: 'var(--student-deep)' }}>{view.lastSync}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 9 }}>latest scan reaching the server</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 22px 0', alignItems: 'center', flex: 'none' }}>
        <select style={selectStyle} value={method} onChange={(e) => setParam('method', e.target.value)}>
          <option value="all">Method: All</option>
          <option value="QR">QR</option>
          <option value="RFID">RFID</option>
          <option value="Manual">Manual</option>
        </select>
        <select style={selectStyle} value={checker} onChange={(e) => setParam('checker', e.target.value)}>
          <option value="all">Checker: All</option>
          {checkers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={selectStyle} value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="all">Status: All</option>
          <option value="valid">Valid</option>
          <option value="review">For review</option>
        </select>
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
        <input
          className="filter-pill"
          style={{ marginLeft: 'auto', width: 170, border: 'none', outline: 'none', color: 'var(--ink)' }}
          placeholder="Search students…"
          value={query}
          onChange={(e) => setParam('q', e.target.value)}
        />
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
          {rows.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              {view.rows.length === 0
                ? 'No scans yet — they appear here in realtime as checkers scan.'
                : 'No scans match the current filters.'}
            </div>
          )}
        </div>
        <div className="table-foot">
          <span>Showing {rows.length} of {view.present} scans</span>
          <span>Last scan synced {view.lastSync}</span>
        </div>
      </div>
    </>
  );
}
