import { PageHeader } from '../components/Shell';
import { LoadError } from '../components/ConfirmDialog';
import { useLoadedState, loadDashStats, downloadCsv } from '../data/api';

const SCHOOL_BAR_STYLES = [
  { bar: 'var(--student)', text: 'var(--student-deep)' },
  { bar: 'var(--checker)', text: 'var(--checker-deep)' },
  { bar: 'var(--maker)', text: 'var(--maker-deep)' },
  { bar: 'var(--alert)', text: 'var(--alert-deep)' },
];

export default function Dashboard() {
  const { data: live, loading, error, retry } = useLoadedState(loadDashStats, null);
  const stats = [
    { label: 'SEMESTER ATTENDANCE', value: live?.avgRate != null ? `${live.avgRate}%` : '—', color: 'var(--checker-deep)' },
    { label: 'ACTIVE STUDENTS', value: live ? String(live.students) : '—' },
    { label: 'PENDING REVIEW', value: live ? String(live.pendingReview) : '—', color: 'var(--alert-deep)' },
    { label: 'UNPAID FINES', value: live ? `₱${live.unpaidFines.toLocaleString()}` : '—', color: 'var(--danger-deep)' },
  ];
  const bars = (live?.schoolBars ?? [])
    .map((b, i) => ({ ...b, ...SCHOOL_BAR_STYLES[i % SCHOOL_BAR_STYLES.length] }));
  const trend = live?.trend ?? [];
  const absentees = live?.absentees ?? [];

  const exportAbsentees = () => downloadCsv(
    'chronic-absentees.csv',
    ['Student', 'Course', 'Missed', 'Unpaid fines'],
    absentees.map((a) => [a.name, a.course, a.missed, a.fines]),
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={live
          ? `1st Semester, S.Y. 2026–27 · ${live.events} event${live.events === 1 ? '' : 's'} so far`
          : '1st Semester, S.Y. 2026–27'}
      />
      {error && !live && <LoadError retry={retry} what="dashboard stats" />}
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
            {bars.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--muted)', padding: '14px 0' }}>
                {loading ? 'Loading…' : 'No scans yet — bars appear once events record attendance.'}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12 }}>
            Scan share per school, relative to the busiest school
          </div>
        </div>
        <div className="card" style={{ flex: 1, padding: '15px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div className="card-title">Trend across events</div>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>last 8</span>
          </div>
          {trend.length > 0 ? (
            <>
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
            </>
          ) : (
            <div style={{ height: 96, display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
              {loading ? 'Loading…' : 'No events have opened check-in yet.'}
            </div>
          )}
        </div>
      </div>
      <div className="card" style={{ margin: '12px 22px 18px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 180 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid var(--hairline-2)' }}>
          <div className="card-title">
            Top unpaid fines{' '}
            <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>· unexcused absences this semester</span>
          </div>
          {absentees.length > 0 && (
            <button className="pill-btn ghost" style={{ padding: '5px 12px', fontSize: 10.5 }} onClick={exportAbsentees}>
              ↓ Export CSV
            </button>
          )}
        </div>
        <div className="table-head" style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .9fr .9fr', gap: 8, padding: '10px 18px' }}>
          <div>STUDENT</div><div>COURSE</div><div>MISSED</div><div>UNPAID FINES</div>
        </div>
        {absentees.map((a) => (
          <div key={a.name} className="table-row" style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .9fr .9fr', gap: 8, padding: '9px 18px' }}>
            <div style={{ fontWeight: 700 }}>{a.name}</div>
            <div>{a.course}</div>
            <div style={{ fontWeight: 700, color: 'var(--danger-deep)' }}>{a.missed}</div>
            <div style={{ fontWeight: 700 }}>{a.fines}</div>
          </div>
        ))}
        {absentees.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
            {loading ? 'Loading…' : 'No unpaid fines — every absence is excused or settled.'}
          </div>
        )}
        <div className="table-foot" style={{ justifyContent: 'flex-start' }}>
          Full per-event exports live on the Live attendance and Reports pages
        </div>
      </div>
    </>
  );
}
