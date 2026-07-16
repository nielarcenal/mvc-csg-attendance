import { PageHeader } from '../components/Shell';
import { AUDIT_ROWS } from '../data/mock';
import { useLoaded, loadAudit, hasBackend } from '../data/api';

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

export default function AuditLog() {
  const rows = useLoaded(loadAudit, hasBackend ? [] : AUDIT_ROWS);
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only — read-only for every role, including super-admin"
        actions={
          <>
            <button className="filter-pill" style={{ padding: '7px 13px' }}>Actor: All ▾</button>
            <button className="filter-pill" style={{ padding: '7px 13px' }}>Table: All ▾</button>
            <button className="filter-pill" style={{ padding: '7px 13px' }}>Action: All ▾</button>
            <button className="filter-pill" style={{ padding: '7px 13px' }}>Jul 15 ▾</button>
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
        <div className="table-foot" style={{ padding: '9px 18px' }}>
          <span>Written automatically by database triggers — no role can edit or delete entries</span>
          <span>{hasBackend ? `Latest ${rows.length} entries` : '1–7 of 12,406'}</span>
        </div>
      </div>
    </>
  );
}
