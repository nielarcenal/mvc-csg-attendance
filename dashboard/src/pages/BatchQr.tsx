import { useMemo, useState } from 'react';
import { PageHeader } from '../components/Shell';
import { useLoadedState, loadQrCards } from '../data/api';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`toggle ${on ? 'on' : 'off'}`} onClick={() => onChange(!on)}>
      <div className="knob" />
    </div>
  );
}

// FEATURE_BATCH_2 §B: long names scale down gradually instead of wrapping
// or overflowing the card. ~17 chars are guaranteed to fit at full size in
// the card's text column (wide glyphs included); beyond that the font
// shrinks proportionally, floored at 6px.
function nameFontSize(name: string): number {
  const longest = Math.max(...name.split('\n').map((l) => l.length), 1);
  return Math.max(6, Math.min(10.5, (10.5 * 17) / longest));
}

// A line past ~33 chars can't fit even at the 6px floor and would soft-wrap
// unpredictably — give it one deliberate break at the space nearest its
// middle instead, so both halves scale to a readable size.
function fitName(name: string): string {
  return name.split('\n').map((line) => {
    if (line.length <= 33) return line;
    const mid = line.length / 2;
    let best = -1;
    for (let i = line.indexOf(' '); i !== -1; i = line.indexOf(' ', i + 1)) {
      if (best === -1 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
    }
    return best === -1 ? line : line.slice(0, best) + '\n' + line.slice(best + 1);
  }).join('\n');
}

export default function BatchQr() {
  const [scope, setScope] = useState('all'); // 'all' or a course code
  const [cutGuides, setCutGuides] = useState(true);
  const [photoBox, setPhotoBox] = useState(false);
  const [page, setPage] = useState(1);
  const { data: allCards, loading } = useLoadedState(loadQrCards, []);
  // Course code = first word of the course string ("BSIT 3-A" → "BSIT").
  const courses = useMemo(
    () => [...new Set(allCards.map((c) => c.course.split(' ')[0]).filter(Boolean))].sort(),
    [allCards],
  );
  const cards = scope === 'all' ? allCards : allCards.filter((c) => c.course.startsWith(scope));
  const total = cards.length;
  const pages = Math.max(1, Math.ceil(cards.length / 4));
  const visible = cards.slice((page - 1) * 4, page * 4);

  // Opens a print-ready window with every card — the browser's print
  // dialog saves it as the PDF.
  const printCards = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const border = cutGuides ? '1px dashed #cfd6d2' : '1px solid transparent';
    const photo = photoBox
      ? '<div style="width:40px;height:48px;margin-left:auto;border:1px dashed #cfd6d2;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;font-size:6.5px;color:#9aa4ad">1×1</div>'
      : '';
    const cardHtml = cards.map((raw) => { const c = { ...raw, name: fitName(raw.name) }; return `
      <div style="border:${border};border-radius:8px;overflow:hidden;break-inside:avoid">
        <div style="background:#3f9bd8;color:#fff;display:flex;align-items:center;gap:6px;padding:6px 9px">
          <span style="font-size:7px;font-weight:800;letter-spacing:.08em">MVC CENTRAL STUDENT GOVERNMENT</span>
        </div>
        <div style="display:flex;gap:9px;padding:9px;align-items:center">
          <img src="${c.qr}" style="width:78px;height:78px;image-rendering:pixelated;flex:none" />
          <div style="min-width:0">
            <div style="font-size:${nameFontSize(c.name)}px;font-weight:800;line-height:1.2;white-space:pre-line">${c.name}</div>
            <div style="font-size:8.5px;color:#2b6da0;font-weight:700;margin-top:3px">${c.no}</div>
            <div style="font-size:8px;color:#6b7580;margin-top:1px">${c.course}</div>
          </div>
          ${photo}
        </div>
      </div>`; }).join('');
    w.document.write(`<!doctype html><html><head><title>CSG QR ID cards</title>
      <style>body{font-family:system-ui,sans-serif;margin:14mm}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}</style>
      </head><body><div class="grid">${cardHtml}</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
    w.document.close();
  };

  return (
    <>
      <PageHeader
        crumb={<>Reports / <span style={{ color: 'var(--maker-deep)' }}>Printable QR IDs</span></>}
        title="Batch QR ID cards"
        actions={
          <button
            className="pill-btn primary"
            style={{ padding: '10px 22px', fontSize: 12.5, opacity: total === 0 ? 0.5 : 1 }}
            disabled={total === 0}
            onClick={printCards}
          >
            Generate PDF · {total} cards
          </button>
        }
      />
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '2px 22px 18px', minHeight: 0 }}>
        <div style={{ width: 330, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Scope</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['all', ...courses].map((c) => (
                <button
                  key={c}
                  className="pill-btn"
                  onClick={() => { setScope(c); setPage(1); }}
                  style={scope === c
                    ? { background: 'var(--dark-card)', color: '#fff', padding: '6px 13px', fontSize: 11 }
                    : { background: 'var(--bg)', color: 'var(--text-2)', padding: '6px 13px', fontSize: 11, fontWeight: 700 }}
                >
                  {c === 'all' ? `All students · ${allCards.length}` : c}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="card-title" style={{ marginBottom: 11 }}>Layout</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Paper</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>A4 · portrait</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Layout</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>2 per row, flowing</span>
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
                      <div style={{ fontSize: nameFontSize(fitName(c.name)), fontWeight: 800, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{fitName(c.name)}</div>
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
              {visible.length === 0
                ? (loading ? 'Loading roster…' : 'No students on the roster yet — import a CSV from the Accounts page.')
                : `Preview — ${visible.length} card${visible.length === 1 ? '' : 's'} on page ${page}`}
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
