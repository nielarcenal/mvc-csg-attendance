import { useMemo, useState } from 'react';
import { PageHeader } from '../components/Shell';
import { ConfirmDialog, LoadError } from '../components/ConfirmDialog';
import { ReviewItem } from '../data/types';
import { useLoadedState, loadReviewItems, decideReview } from '../data/api';
import { useAuth } from '../lib/auth';

type Decision = 'approved' | 'rejected';

export default function ReviewQueue() {
  const [tab, setTab] = useState<'all' | 'late' | 'excuse'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const { profile } = useAuth();
  const { data: all, loading, error: loadFailed, retry } = useLoadedState(loadReviewItems, []);

  const items = useMemo(
    () => all.filter((i) => tab === 'all' || i.kind === tab),
    [all, tab],
  );
  const selected: ReviewItem | undefined = items.find((i) => i.id === selectedId) ?? items[0];
  const decision = selected ? decisions[selected.id] : undefined;
  const countOf = (k: 'late' | 'excuse') => all.filter((i) => i.kind === k).length;

  const decide = async (d: Decision) => {
    if (!selected) return;
    setError(null);
    const err = await decideReview(selected.id, d === 'approved');
    if (err) { setError(err); return; }
    setDecisions((prev) => ({ ...prev, [selected.id]: d }));
  };

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Every decision is written to the audit log"
        actions={
          <>
            <button className={`filter-pill${tab === 'all' ? ' active' : ''}`} style={{ padding: '7px 14px' }} onClick={() => setTab('all')}>All · {all.length}</button>
            <button className={`filter-pill${tab === 'late' ? ' active' : ''}`} style={{ padding: '7px 14px' }} onClick={() => setTab('late')}>Late scans · {countOf('late')}</button>
            <button className={`filter-pill${tab === 'excuse' ? ' active' : ''}`} style={{ padding: '7px 14px' }} onClick={() => setTab('excuse')}>Excuses · {countOf('excuse')}</button>
          </>
        }
      />
      {items.length === 0 && (
        loadFailed ? <LoadError retry={retry} what="the review queue" />
        : (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>
            {loading ? 'Loading review queue…' : 'Queue is clear — nothing waiting for review.'}
          </div>
        )
      )}
      {selected && (
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '2px 22px 18px', minHeight: 0 }}>
        <div style={{ width: 380, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
          {items.map((item) => {
            const active = item.id === selected.id;
            const done = decisions[item.id];
            return (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 14,
                  boxShadow: active ? '0 4px 16px rgba(35,42,49,.09)' : '0 2px 10px rgba(35,42,49,.05)',
                  border: active ? '2px solid var(--alert)' : '2px solid transparent',
                  padding: '12px 14px',
                  textAlign: 'left',
                  opacity: done ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={item.kind === 'late' ? 'chip orange' : 'chip blue'} style={{ padding: '3px 9px' }}>{item.tag}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>
                    {done ? (done === 'approved' ? 'Approved ✓' : 'Rejected') : item.when}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 7 }}>
                  {item.name} <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>· {item.course}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 2 }}>{item.line}</div>
              </button>
            );
          })}
        </div>

        <div
          className="card"
          style={{ flex: 1, minWidth: 0, borderRadius: 18, boxShadow: '0 4px 18px rgba(35,42,49,.07)', padding: '20px 22px', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
              <span className="avatar" style={{ width: 44, height: 44, fontSize: 15, background: selected.detail.color }}>{selected.detail.initials}</span>
              <div>
                <div className="display" style={{ fontSize: 18 }}>{selected.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>
                  {selected.detail.studentNo} · {selected.course} · {selected.detail.event}
                </div>
              </div>
            </div>
            <span className={selected.kind === 'late' ? 'chip orange' : 'chip blue'} style={{ padding: '5px 12px', fontSize: 10.5 }}>
              {decision ? (decision === 'approved' ? 'Approved — counts as present' : 'Rejected') : selected.detail.statusChip}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
            {selected.detail.tiles.map((t) => (
              <div key={t.label} style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 12px' }}>
                <div className="section-label">{t.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 3 }}>{t.value}</div>
                <div style={{ fontSize: 9.5, color: t.subTone === 'red' ? 'var(--danger-deep)' : 'var(--text-2)', fontWeight: t.subTone === 'red' ? 700 : 400, marginTop: 1 }}>
                  {t.sub}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, background: selected.kind === 'late' ? 'rgba(226,145,63,.08)' : 'rgba(63,155,216,.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div className="section-label" style={{ color: selected.kind === 'late' ? 'var(--alert-deep)' : 'var(--student-deep)' }}>{selected.detail.noteLabel}</div>
            <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>{selected.detail.note}</div>
          </div>

          {selected.detail.similar && (
            <div style={{ marginTop: 14 }}>
              <div className="section-label">SIMILAR PENDING</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 4 }}>{selected.detail.similar}</div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="pill-btn"
              onClick={() => decide('approved')}
              disabled={!!decision}
              style={{
                background: 'var(--checker)', color: '#fff', padding: '12px 26px', fontSize: 12.5,
                boxShadow: '0 6px 18px rgba(53,164,99,.3)', opacity: decision ? 0.5 : 1,
              }}
            >
              Approve — counts as present
            </button>
            <button
              className="pill-btn"
              onClick={() => setConfirmingReject(true)}
              disabled={!!decision}
              style={{ border: '1.5px solid var(--danger)', color: 'var(--danger-deep)', padding: '12px 22px', fontSize: 12.5, opacity: decision ? 0.5 : 1 }}
            >
              Reject
            </button>
            {confirmingReject && (
              <ConfirmDialog
                title={`Reject ${selected.name}?`}
                body={selected.kind === 'late'
                  ? 'The scan stays on record as rejected and does NOT count as present. A fine may apply when the event closes.'
                  : 'The excuse is marked rejected — the absence stays unexcused and its fine stands.'}
                confirmLabel="Reject"
                destructive
                onCancel={() => setConfirmingReject(false)}
                onConfirm={() => { setConfirmingReject(false); decide('rejected'); }}
              />
            )}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>
              {error ? <span style={{ color: 'var(--danger-deep)' }}>{error}</span>
                : `Logged to audit trail as ${profile?.full_name ?? '—'}`}
            </span>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
