import { useMemo, useState } from 'react';
import { PageHeader } from '../components/Shell';
import { LoadError } from '../components/ConfirmDialog';
import { useLoadedState, loadAudit } from '../data/api';

const GRID = '.75fr .95fr .8fr 1fr 1.9fr';

const ACTION_CLS: Record<string, string> = {
  green: 'chip green', purple: 'chip purple', blue: 'chip blue',
  orange: 'chip orange', red: 'chip red', dark: 'chip dark',
};

const DIFF_TONE: Record<string, { bg: string; color: string }> = {
  orange: { bg: 'rgba(226,145,63,.14)', color: 'var(--alert-deep)' },
  green: { bg: 'rgba(53,164,99,.12)', color: 'var(--checker-deep)' },
  gray: { bg: 'var(--hairline-2)', color: 'var(--text-2)' },
};

function DiffChip({ text, tone }: { text: string; tone: string }) {
  const t = DIFF_TONE[tone] ?? DIFF_TONE.gray;
  return (
    <span style={{ background: t.bg, color: t.color, borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>{text}</span>
  );
}

const selectStyle = {
  padding: '7px 12px', borderRadius: 99, border: '1px solid var(--hairline)',
  background: 'var(--surface)', fontSize: 11, fontWeight: 700, color: 'var(--ink)',
} as const;

const dateStyle = {
  padding: '6px 10px', borderRadius: 99, border: '1px solid var(--hairline)',
  background: 'var(--surface)', fontSize: 11, fontWeight: 700, color: 'var(--ink)',
} as const;

export default function AuditLog() {
  const { data: all, loading, error, retry } = useLoadedState(loadAudit, [], [], { auto: true });
  const [actor, setActor] = useState('all');
  const [table, setTable] = useState('all');
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState(''); // YYYY-MM-DD (local)
  const [to, setTo] = useState('');

  const actors = useMemo(() => [...new Set(all.map((r) => r.actor))].sort(), [all]);
  const tables = useMemo(() => [...new Set(all.map((r) => r.table))].sort(), [all]);
  const actions = useMemo(() => [...new Set(all.map((r) => r.action))].sort(), [all]);
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
  const rows = all.filter((r) => {
    const at = new Date(r.createdAt).getTime();
    return (actor === 'all' || r.actor === actor)
      && (table === 'all' || r.table === table)
      && (action === 'all' || r.action === action)
      && (fromMs === null || at >= fromMs)
      && (toMs === null || at <= toMs);
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only — read-only for every role, including super-admin"
        actions={
          <>
            <select style={selectStyle} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="all">Actor: All</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select style={selectStyle} value={table} onChange={(e) => setTable(e.target.value)}>
              <option value="all">Table: All</option>
              {tables.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={selectStyle} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">Action: All</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <input type="date" style={dateStyle} value={from} max={to || undefined}
              onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>–</span>
            <input type="date" style={dateStyle} value={to} min={from || undefined}
              onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            <button className="pill-btn" style={{ padding: '7px 14px', fontSize: 11 }} onClick={retry}>
              ↻ Refresh
            </button>
          </>
        }
      />
      <div className="card" style={{ margin: '2px 22px 18px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 18px' }}>
          <div>TIME</div><div>ACTOR</div><div>ACTION</div><div>RECORD</div><div>CHANGE (OLD → NEW)</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={`${r.time}-${r.actor}-${i}`}
            className="table-row"
            style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '10px 18px', background: r.highlight ? 'rgba(53,164,99,.05)' : undefined }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>{r.time}</div>
            <div style={{ fontWeight: 700 }}>
              {r.actor} {r.device && <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 400 }}>{r.device}</span>}
            </div>
            <div><span className={ACTION_CLS[r.actionTone]} style={{ padding: '3px 10px' }}>{r.action}</span></div>
            <div style={{ color: 'var(--text-2)' }}>{r.record}</div>
            <div style={{ fontSize: 11 }}>
              {r.change.kind === 'diff' ? (
                <>
                  <DiffChip text={r.change.from} tone={r.change.fromTone} /> →{' '}
                  <DiffChip text={r.change.to} tone={r.change.toTone} />{' '}
                  <span style={{ color: 'var(--muted)' }}>{r.change.note}</span>
                </>
              ) : (
                <span style={{ color: 'var(--muted)' }}>{r.change.text}</span>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          error && all.length === 0 ? <LoadError retry={retry} what="the audit log" />
          : (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              {loading ? 'Loading audit log…'
                : all.length === 0 ? 'No audit entries yet — they appear as records change.'
                  : 'No entries match the current filters.'}
            </div>
          )
        )}
        <div className="table-foot" style={{ padding: '9px 18px' }}>
          <span>Written automatically by database triggers — no role can edit or delete entries</span>
          <span>Latest {rows.length} of {all.length} entries</span>
        </div>
      </div>
    </>
  );
}
