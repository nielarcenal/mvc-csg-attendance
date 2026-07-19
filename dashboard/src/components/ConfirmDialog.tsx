import { ReactNode, useEffect, useRef } from 'react';

/** Close-on-Escape for any overlay (UX §8). */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

/**
 * UX §4 confirmation dialog: names the object in the title, Cancel is the
 * default (focused) action, and the confirm button restates the verb —
 * red when destructive. The barrier sits above the whole app (header
 * included) and SWALLOWS background clicks — Esc and Cancel are the only
 * ways out (FEATURE_BATCH_2 §B).
 */
export function ConfirmDialog({
  title, body, confirmLabel, destructive = false, busy = false, onConfirm, onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEscape(onCancel);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(35,42,49,.4)', display: 'grid', placeItems: 'center', zIndex: 60 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 380, borderRadius: 18, padding: 22 }}>
        <div className="display" style={{ fontSize: 17 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.55 }}>{body}</div>
        <div style={{ display: 'flex', gap: 9, marginTop: 18, justifyContent: 'flex-end' }}>
          <button ref={cancelRef} className="pill-btn ghost" style={{ padding: '9px 18px' }} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="pill-btn"
            disabled={busy}
            onClick={onConfirm}
            style={destructive
              ? { background: 'var(--danger)', color: '#fff', padding: '9px 18px', opacity: busy ? 0.6 : 1 }
              : { background: 'var(--maker)', color: '#fff', padding: '9px 18px', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** UX §5 error state: message + a Retry that actually refetches. */
export function LoadError({ retry, what = 'this view' }: { retry: () => void; what?: string }) {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: 'var(--danger-deep)', fontSize: 12, fontWeight: 600 }}>
      Couldn’t load {what} — check your connection.
      <button
        className="pill-btn"
        onClick={retry}
        style={{ marginLeft: 10, border: '1.5px solid var(--danger)', color: 'var(--danger-deep)', padding: '5px 14px', fontSize: 11 }}
      >
        Retry
      </button>
    </div>
  );
}
