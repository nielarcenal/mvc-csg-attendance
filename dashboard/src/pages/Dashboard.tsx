import { PageHeader } from '../components/Shell';
import { useLoaded, loadDashStats, hasBackend } from '../data/api';

const SCHOOL_BAR_STYLES = [
  { bar: 'var(--student)', text: 'var(--student-deep)' },
  { bar: 'var(--checker)', text: 'var(--checker-deep)' },
  { bar: 'var(--maker)', text: 'var(--maker-deep)' },
  { bar: 'var(--alert)', text: 'var(--alert-deep)' },
];

const SCHOOL_BARS = [
  { school: 'SOC', pct: 91, bar: 'var(--student)', text: 'var(--student-deep)' },
  { school: 'SOE', pct: 88, bar: 'var(--checker)', text: 'var(--checker-deep)' },
  { school: 'SBA', pct: 85, bar: 'var(--maker)', text: 'var(--maker-deep)' },
  { school: 'SON', pct: 79, bar: 'var(--alert)', text: 'var(--alert-deep)' },
];

const TREND = [
  { date: '5/12', h: 68 }, { date: '5/26', h: 74 }, { date: '6/05', h: 62 }, { date: '6/12', h: 80 },
  { date: '6/26', h: 71 }, { date: '7/01', h: 84 }, { date: '7/08', h: 78 }, { date: '7/15', h: 90, latest: true, tip: '76%' },
];

const ABSENTEES = [
  { name: 'Ocampo, Dave S.', course: 'BSN 2-C', missed: '5 of 25', fines: '₱250' },
  { name: 'Ramirez, Cielo B.', course: 'BSBA 3-B', missed: '4 of 25', fines: '₱200' },
  { name: 'Uy, Francis D.', course: 'BSIT 1-B', missed: '3 of 25', fines: '₱150' },
];

const STATS = [
  { label: 'SEMESTER ATTENDANCE', value: '87%', color: 'var(--checker-deep)' },
  { label: 'ACTIVE STUDENTS', value: '460' },
  { label: 'PENDING EXCUSES', value: '2', color: 'var(--alert-deep)' },
  { label: 'UNPAID FINES', value: '₱2,350', color: 'var(--danger-deep)' },
];

export default function Dashboard() {
  const live = useLoaded(loadDashStats, null);
  const stats = live ? [
    { label: 'SEMESTER ATTENDANCE', value: live.avgRate != null ? `${live.avgRate}%` : '—', color: 'var(--checker-deep)' },
    { label: 'ACTIVE STUDENTS', value: String(live.students) },
    { label: 'PENDING REVIEW', value: String(live.pendingReview), color: 'var(--alert-deep)' },
    { label: 'UNPAID FINES', value: `₱${live.unpaidFines.toLocaleString()}`, color: 'var(--danger-deep)' },
  ] : STATS;
  const bars = live
    ? live.schoolBars.map((b, i) => ({ ...b, ...SCHOOL_BAR_STYLES[i % SCHOOL_BAR_STYLES.length] }))
    : SCHOOL_BARS;
  const trend = live && live.trend.length ? live.trend : (live ? [] : TREND);
  const absentees = live ? live.absentees : ABSENTEES;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={live
          ? `1st Semester, S.Y. 2026–27 · ${live.events} event${live.events === 1 ? '' : 's'} so far`
          : '1st Semester, S.Y. 2026–27 · 25 events so far'}
        actions={
          <>
            <button className="filter-pill" style={{ padding: '8px 15px' }}>1st Sem 2026–27 ▾</button>
            <button className="pill-btn ghost" style={{ padding: '8px 16px', fontSize: 11.5 }}>Export PDF</button>
            <button className="pill-btn primary" style={{ padding: '8px 18px', fontSize: 11.5 }}>Export Excel</button>
          </>
        }
      />
      <div style={{ display: 'flex', gap: 12, padding: '2px 22px 0', flex: 'none' }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ flex: 1, padding: '13px 16px' }}>
            <div className="section-label" style={{ fontSize: 9.5 }}>{s.label}</div>
            <div className="display" style={{ fontSize: 24, marginTop: 2, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '12px 22px 0', flex: 'none' }}>
        <div className="card" style={{ flex: 1, padding: '15px 18px' }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Attendance by school</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bars.map((b) => (
              <div key={b.school} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 56, fontSize: 11, fontWeight: 700 }}>{b.school}</span>
                <div style={{ flex: 1, height: 9, borderRadius: 5, background: 'var(--hairline-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${b.pct}%`, height: '100%', borderRadius: 5, background: b.bar }} />
                </div>
                <span style={{ width: 32, textAlign: 'right', fontSize: 11, fontWeight: 800, color: b.text }}>{b.pct}%</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12 }}>
            Required events only · click a school to drill into course &amp; section
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: '15px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div className="card-title">Trend across events</div>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>last 8</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, height: 96 }}>
            {trend.map((t) => (
              <div
                key={t.date}
                style={{
                  flex: 1,
                  height: `${t.h}%`,
                  borderRadius: '6px 6px 3px 3px',
                  background: t.latest ? 'var(--checker)' : '#cfe0d6',
                  position: 'relative',
                }}
              >
                {t.tip && (
                  <div
                    style={{
                      position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                      background: 'var(--dark-card)', color: '#fff', borderRadius: 6,
                      padding: '2px 7px', fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap',
                    }}
                  >
                    {t.tip}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
            {trend.map((t) => (
              <span
                key={t.date}
                style={{
                  flex: 1, textAlign: 'center', fontSize: 8.5,
                  color: t.latest ? 'var(--checker-deep)' : 'var(--muted)',
                  fontWeight: t.latest ? 800 : 600,
                }}
              >
                {t.date}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ margin: '12px 22px 18px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 180 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid var(--hairline-2)' }}>
          <div className="card-title">
            Chronic absentees{' '}
            <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>· 3+ unexcused this semester</span>
          </div>
          <button className="pill-btn ghost" style={{ padding: '5px 12px', fontSize: 10.5 }}>Export list</button>
        </div>
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .9fr .9fr 1fr', gap: 8, padding: '10px 18px' }}>
          <div>STUDENT</div><div>COURSE</div><div>MISSED</div><div>UNPAID FINES</div><div>ACTION</div>
        </div>
        {absentees.map((a) => (
          <div key={a.name} className="table-row" style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .9fr .9fr 1fr', gap: 8, padding: '9px 18px' }}>
            <div style={{ fontWeight: 700 }}>{a.name}</div>
            <div>{a.course}</div>
            <div style={{ fontWeight: 700, color: 'var(--danger-deep)' }}>{a.missed}</div>
            <div style={{ fontWeight: 700 }}>{a.fines}</div>
            <div><button className="pill-btn ghost" style={{ padding: '4px 11px', fontSize: 10, fontWeight: 800 }}>Notify adviser</button></div>
          </div>
        ))}
        <div className="table-foot" style={{ justifyContent: 'flex-start' }}>
          Reports export per event or per semester — attendance sheet, absentee list, fines summary
        </div>
      </div>
    </>
  );
}
