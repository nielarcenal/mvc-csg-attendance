import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/Shell';
import { LoadError } from '../components/ConfirmDialog';
import {
  useLoadedState, loadReportFacets, loadStudentReport, loadEventReport,
  downloadCsv, StudentReport, EventReport,
} from '../data/api';

// FEATURE_BATCH_2 §B Exports: the event maker picks either a Student
// report (one student across all events/sessions) or an Event report
// (per-session sheets) and downloads it as .xlsx or .csv. Everything is
// computed from live Supabase rows at click time — no cached snapshots.

type Kind = 'student' | 'event';

const STUDENT_HEADERS =
  ['Event', 'Session', 'Date', 'Status', 'Time in', 'Time out', 'Method', 'Checker', 'Note'];
const EVENT_HEADERS =
  ['Student no', 'Name', 'School', 'Status', 'Time in', 'Time out', 'Method', 'Checker', 'Note'];

function studentAoa(r: StudentReport): (string | number)[][] {
  return [
    [`Student report — ${r.student.name}`],
    [`${r.student.no} · ${r.student.school}${r.student.course ? ` · ${r.student.course}` : ''}`],
    [`Sessions: ${r.summary.sessions} · Present ${r.summary.present} · Late ${r.summary.late}`
      + ` · Excused ${r.summary.excused} · Absent ${r.summary.absent}`],
    [],
    STUDENT_HEADERS,
    ...r.rows.map((x) =>
      [x.event, x.session, x.date, x.status, x.timeIn, x.timeOut, x.method, x.checker, x.note]),
  ];
}

function eventAoa(s: EventReport['sessions'][number]): (string | number)[][] {
  return [
    [`${s.label} · ${s.window} · ${s.mode === 'in_out' ? 'check-in & out' : 'check-in only'}`],
    [`Present ${s.counts.present} · Late ${s.counts.late} · Excused ${s.counts.excused}`
      + ` · Absent ${s.counts.absent}`],
    [],
    EVENT_HEADERS,
    ...s.rows.map((x) =>
      [x.no, x.name, x.school, x.status, x.timeIn, x.timeOut, x.method, x.checker, x.note]),
  ];
}

function sheetOf(aoa: (string | number)[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 24 }];
  return ws;
}

// Excel sheet names: ≤31 chars, no []:*?/\ — and unique per workbook.
function sheetName(label: string, used: Set<string>): string {
  let base = label.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Session';
  let name = base; let n = 2;
  while (used.has(name)) name = `${base} (${n++})`;
  used.add(name);
  return name;
}

export default function Reports() {
  const { data: facets, loading, error, retry } = useLoadedState(loadReportFacets, null);
  const [kind, setKind] = useState<Kind>('event');
  const [studentId, setStudentId] = useState('');
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const students = facets?.students ?? [];
  const events = facets?.events ?? [];
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students
      .filter((s) => s.name.toLowerCase().includes(q) || s.no.includes(q))
      .slice(0, 8);
  }, [students, search]);
  const chosenStudent = students.find((s) => s.id === studentId);
  const ready = kind === 'student' ? !!studentId : !!eventId;

  async function build(format: 'xlsx' | 'csv') {
    if (!ready || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (kind === 'student') {
        const r = await loadStudentReport(studentId);
        if (!r) throw new Error('load failed');
        const stem = `student-report-${r.student.no}`;
        if (format === 'xlsx') {
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, sheetOf(studentAoa(r)), 'Attendance');
          XLSX.writeFile(wb, `${stem}.xlsx`);
        } else {
          downloadCsv(`${stem}.csv`, STUDENT_HEADERS, r.rows.map((x) =>
            [x.event, x.session, x.date, x.status, x.timeIn, x.timeOut, x.method, x.checker, x.note]));
        }
        setMessage(`Exported ${r.rows.length} session rows for ${r.student.name}.`);
      } else {
        const r = await loadEventReport(eventId);
        if (!r) throw new Error('load failed');
        const stem = `event-report-${r.event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        if (r.sessions.length === 0) {
          setMessage('This event has no sessions yet — nothing to export.');
          return;
        }
        if (format === 'xlsx') {
          const wb = XLSX.utils.book_new();
          const used = new Set<string>();
          for (const s of r.sessions) {
            XLSX.utils.book_append_sheet(wb, sheetOf(eventAoa(s)), sheetName(s.label, used));
          }
          XLSX.writeFile(wb, `${stem}.xlsx`);
        } else {
          // CSV has no sheets — one flat file with a Session column.
          downloadCsv(`${stem}.csv`, ['Session', ...EVENT_HEADERS],
            r.sessions.flatMap((s) => s.rows.map((x) =>
              [s.label, x.no, x.name, x.school, x.status, x.timeIn, x.timeOut, x.method, x.checker, x.note])));
        }
        const total = r.sessions.reduce((n, s) => n + s.rows.length, 0);
        setMessage(`Exported ${r.sessions.length} session${r.sessions.length === 1 ? '' : 's'}`
          + ` × roster (${total} rows) for ${r.event.name}.`);
      }
    } catch (e) {
      console.error('export failed', e);
      setMessage('Export failed — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const tile = (k: Kind, title: string, sub: string) => (
    <button
      onClick={() => { setKind(k); setMessage(null); }}
      className="card"
      style={{
        textAlign: 'left', padding: '15px 17px', cursor: 'pointer', flex: 1,
        border: kind === k ? '2px solid var(--maker-deep)' : '2px solid transparent',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.5 }}>{sub}</div>
    </button>
  );

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Attendance exports computed live from Supabase"
        actions={
          <Link to="/reports/qr" className="pill-btn" style={{ padding: '9px 18px', fontSize: 11.5, textDecoration: 'none' }}>
            Printable QR IDs →
          </Link>
        }
      />
      <div style={{ padding: '2px 22px 18px', maxWidth: 760 }}>
        {error && !facets ? <div className="card"><LoadError retry={retry} what="report data" /></div> : (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              {tile('event', 'Event report',
                'One event — a sheet per session with present / late / absent for the whole roster, method and checker.')}
              {tile('student', 'Student report',
                'One student — their status for every event session, with times, method and checker.')}
            </div>

            <div className="card" style={{ marginTop: 12, padding: '16px 18px' }}>
              {kind === 'event' ? (
                <>
                  <div className="card-title" style={{ marginBottom: 9 }}>Which event?</div>
                  <select
                    value={eventId} onChange={(e) => { setEventId(e.target.value); setMessage(null); }}
                    style={{ width: '100%', padding: '10px 13px', borderRadius: 12, border: '1px solid var(--hairline)', fontSize: 12.5, fontWeight: 600, background: 'var(--surface)' }}
                  >
                    <option value="">{loading ? 'Loading events…' : events.length ? 'Select an event' : 'No events yet'}</option>
                    {events.map((e) => <option key={e.id} value={e.id}>{e.date} — {e.name}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <div className="card-title" style={{ marginBottom: 9 }}>Which student?</div>
                  {chosenStudent ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderRadius: 12, background: 'var(--bg)' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, flex: 1 }}>
                        {chosenStudent.name}
                        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}> · {chosenStudent.no} · {chosenStudent.school}</span>
                      </span>
                      <button className="pill-btn" style={{ padding: '5px 12px', fontSize: 10.5 }}
                        onClick={() => { setStudentId(''); setSearch(''); }}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder={loading ? 'Loading roster…' : 'Search name or student no.'}
                        style={{ width: '100%', padding: '10px 13px', borderRadius: 12, border: '1px solid var(--hairline)', fontSize: 12.5, boxSizing: 'border-box' }}
                      />
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
                        {matches.map((s) => (
                          <button key={s.id} onClick={() => { setStudentId(s.id); setMessage(null); }}
                            style={{ textAlign: 'left', padding: '8px 11px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            {s.name} <span style={{ color: 'var(--text-2)' }}>· {s.no} · {s.school}</span>
                          </button>
                        ))}
                        {!loading && matches.length === 0 && (
                          <div style={{ padding: '10px 11px', fontSize: 11.5, color: 'var(--muted)' }}>
                            No students match “{search}”.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
                <button className="pill-btn primary" disabled={!ready || busy}
                  style={{ padding: '10px 20px', fontSize: 12, opacity: ready && !busy ? 1 : 0.5 }}
                  onClick={() => build('xlsx')}>
                  {busy ? 'Building…' : 'Download .xlsx'}
                </button>
                <button className="pill-btn" disabled={!ready || busy}
                  style={{ padding: '10px 20px', fontSize: 12, opacity: ready && !busy ? 1 : 0.5 }}
                  onClick={() => build('csv')}>
                  Download .csv
                </button>
              </div>
              {message && (
                <div style={{ marginTop: 11, fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>{message}</div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
