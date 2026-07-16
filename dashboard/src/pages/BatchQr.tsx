import { useState } from 'react';
import { PageHeader } from '../components/Shell';
import { QR_CARDS } from '../data/mock';
import { useLoaded, loadQrCards, hasBackend } from '../data/api';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`toggle ${on ? 'on' : 'off'}`} onClick={() => onChange(!on)}>
      <div className="knob" />
    </div>
  );
}

export default function BatchQr() {
  const [scope, setScope] = useState('all');
  const [cutGuides, setCutGuides] = useState(true);
  const [photoBox, setPhotoBox] = useState(false);
  const [page, setPage] = useState(1);
  const cards = useLoaded(loadQrCards, hasBackend ? [] : QR_CARDS);
  const total = hasBackend ? cards.length : 460;
  const pages = hasBackend ? Math.max(1, Math.ceil(cards.length / 4)) : 58;
  const visible = hasBackend ? cards.slice((page - 1) * 4, page * 4) : cards;

  return (
    <>
      <PageHeader
        crumb={<>Reports / <span style={{ color: 'var(--maker-deep)' }}>Printable QR IDs</span></>}
        title="Batch QR ID cards"
        actions={<button className="pill-btn primary" style={{ padding: '10px 22px', fontSize: 12.5 }}>Generate PDF · {total} cards</button>}
      />
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '2px 22px 18px', minHeight: 0 }}>
        <div style={{ width: 330, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Scope</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                className="pill-btn"
                onClick={() => setScope('all')}
                style={scope === 'all'
                  ? { background: 'var(--dark-card)', color: '#fff', padding: '6px 13px', fontSize: 11 }
                  : { background: 'var(--bg)', color: 'var(--text-2)', padding: '6px 13px', fontSize: 11, fontWeight: 700 }}
              >
                All students · {total}
              </button>
              <button className="pill-btn" onClick={() => setScope('school')} style={scope === 'school' ? { background: 'var(--dark-card)', color: '#fff', padding: '6px 13px', fontSize: 11 } : { background: 'var(--bg)', color: 'var(--text-2)', padding: '6px 13px', fontSize: 11, fontWeight: 700 }}>By school ▾</button>
              <button className="pill-btn" onClick={() => setScope('section')} style={scope === 'section' ? { background: 'var(--dark-card)', color: '#fff', padding: '6px 13px', fontSize: 11 } : { background: 'var(--bg)', color: 'var(--text-2)', padding: '6px 13px', fontSize: 11, fontWeight: 700 }}>By section ▾</button>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Layout</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Paper</span>
                <span className="input-box" style={{ width: 'auto', padding: '6px 12px', fontSize: 11.5, fontWeight: 700 }}>A4 · portrait ▾</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Cards per page</span>
                <span className="input-box" style={{ width: 'auto', padding: '6px 12px', fontSize: 11.5, fontWeight: 700 }}>8</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Cut guides</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Dashed trim lines between cards</div>
                </div>
                <Toggle on={cutGuides} onChange={setCutGuides} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>1×1 photo box</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Blank box for pasted photo</div>
                </div>
                <Toggle on={photoBox} onChange={setPhotoBox} />
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(63,155,216,.08)', borderRadius: 14, padding: '12px 15px', fontSize: 11, color: 'var(--student-deep)', lineHeight: 1.55 }}>
            <b>Why printed cards?</b> Students without phones (or with dead batteries) can present a printed QR — it
            encodes the same secure token, never the student number.
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, overflow: 'auto' }}>
          <div style={{ background: '#fff', width: 474, borderRadius: 6, boxShadow: '0 10px 40px rgba(35,42,49,.16)', padding: 20, flex: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
              {visible.map((c) => (
                <div key={c.no} style={{ border: cutGuides ? '1px dashed #cfd6d2' : '1px solid transparent', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--student)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 9px' }}>
                    <img src={`${import.meta.env.BASE_URL}assets/sg-logo.png`} alt="" style={{ width: 13, height: 13, borderRadius: '50%', background: '#fff' }} />
                    <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '.08em' }}>MVC CENTRAL STUDENT GOVERNMENT</span>
                  </div>
                  <div style={{ display: 'flex', gap: 9, padding: 9, alignItems: 'center' }}>
                    <img src={c.qr} alt="" style={{ width: 78, height: 78, imageRendering: 'pixelated', flex: 'none' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{c.name}</div>
                      <div style={{ fontSize: 8.5, color: 'var(--student-deep)', fontWeight: 700, marginTop: 3 }}>{c.no}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-2)', marginTop: 1 }}>{c.course}</div>
                    </div>
                    {photoBox && (
                      <div style={{ width: 40, height: 48, marginLeft: 'auto', border: '1px dashed #cfd6d2', borderRadius: 4, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6.5, color: 'var(--muted)' }}>
                        1×1
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 8.5, color: 'var(--muted)', fontWeight: 600, marginTop: 14 }}>
              Preview — {visible.length} card{visible.length === 1 ? '' : 's'} on page {page}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="filter-pill" style={{ padding: '6px 13px', fontSize: 10.5 }} onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>Page {page} of {pages}</span>
            <button className="filter-pill" style={{ padding: '6px 13px', fontSize: 10.5 }} onClick={() => setPage(Math.min(pages, page + 1))}>›</button>
          </div>
        </div>
      </div>
    </>
  );
}
