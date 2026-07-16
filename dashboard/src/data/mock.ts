// Demo data mirroring the design handoff. In production these come from
// Supabase (see /supabase/migrations); shapes match the spec §5 schema with
// the school-assignment amendment (school replaces gate_label).

export const SCHOOLS = [
  { code: 'SBA', name: 'School of Business and Accountancy' },
  { code: 'SOA', name: 'School of Agriculture' },
  { code: 'SOC', name: 'School of Computing' },
  { code: 'SAS', name: 'School of Arts and Sciences' },
  { code: 'SOT', name: 'School of Theology' },
  { code: 'SON', name: 'School of Nursing' },
  { code: 'SMT', name: 'School of Medical Technology' },
  { code: 'SOE', name: 'School of Education' },
];

export type EventStatus = 'live' | 'upcoming' | 'draft' | 'closed';

export interface EventRow {
  id: string;
  name: string;
  venue: string;
  required: boolean;
  rsvps?: number;
  timeOut?: boolean;
  date: string;
  window: string;
  checkers: number;
  attendance: number | null; // percent
  status: EventStatus;
}

export const EVENTS: EventRow[] = [
  { id: 'ga-2026', name: 'SG General Assembly', venue: 'MVC Gym', required: true, date: 'Jul 15', window: '7:00 – 8:15 AM', checkers: 8, attendance: 76, status: 'live' },
  { id: 'acq-party', name: 'Acquaintance Party', venue: 'Covered Court', required: false, rsvps: 212, date: 'Jul 24', window: '5:30 – 6:30 PM', checkers: 2, attendance: null, status: 'upcoming' },
  { id: 'lead-summit', name: 'Leadership Summit', venue: 'AVR Hall', required: false, date: 'Aug 2', window: '7:30 – 8:30 AM', checkers: 0, attendance: null, status: 'draft' },
  { id: 'cleanup', name: 'Community Cleanup', venue: 'Campus grounds', required: true, date: 'Jul 8', window: '6:00 – 6:45 AM', checkers: 6, attendance: 71, status: 'closed' },
  { id: 'sports-1', name: 'Sports Fest — Day 1', venue: 'Oval', required: true, timeOut: true, date: 'Jun 26', window: '6:30 – 7:30 AM', checkers: 8, attendance: 84, status: 'closed' },
  { id: 'parade', name: 'Foundation Day Parade', venue: 'Main Ave', required: true, timeOut: true, date: 'Jun 12', window: '6:30 – 7:30 AM', checkers: 8, attendance: 91, status: 'closed' },
];

export type Method = 'QR' | 'RFID' | 'Manual';

export interface LiveRow {
  initials: string;
  color: string;
  name: string;
  note?: string;
  noteTone?: 'orange' | 'muted';
  timeIn: string;
  method: Method;
  checker: string;
  school: string;
  sync: string;
  syncOffline?: boolean;
  status: 'valid' | 'review';
  reviewLabel?: string;
  highlight?: boolean;
}

export const LIVE_ROWS: LiveRow[] = [
  { initials: 'PF', color: '#e2913f', name: 'Fernandez, Paolo R.', note: 'just synced · “bus delay”', noteTone: 'orange', timeIn: '8:22', method: 'QR', checker: 'L. Tan', school: 'SOE', sync: '8:22 · 8:22', status: 'review', reviewLabel: 'For review +7m', highlight: true },
  { initials: 'KV', color: '#8e5fae', name: 'Villanueva, Karl D.', timeIn: '8:14', method: 'RFID', checker: 'J. Ramos', school: 'SOC', sync: '8:14 · 8:14', status: 'valid' },
  { initials: 'ME', color: '#3f9bd8', name: 'Estrada, Mae S.', note: '“ID forgotten”', noteTone: 'muted', timeIn: '8:09', method: 'Manual', checker: 'J. Ramos', school: 'SOC', sync: '8:09 · 8:09', status: 'valid' },
  { initials: 'JD', color: '#35a463', name: 'Dela Cruz, Juan Miguel', timeIn: '8:03', method: 'QR', checker: 'R. Uy', school: 'SOC', sync: '8:03 · 8:03', status: 'valid' },
  { initials: 'BG', color: '#e2913f', name: 'Garcia, Bea A.', timeIn: '7:12', method: 'QR', checker: 'L. Tan', school: 'SOE', sync: '7:12 → 7:56 offline sync', syncOffline: true, status: 'valid' },
  { initials: 'LB', color: '#3f9bd8', name: 'Bautista, Leo P.', timeIn: '7:52', method: 'RFID', checker: 'R. Uy', school: 'SOC', sync: '7:52 · 7:52', status: 'valid' },
];

export type ReviewKind = 'late' | 'excuse';

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  tag: string; // e.g. "LATE SCAN · +7 min" | "EXCUSE · medical"
  when: string;
  name: string;
  course: string;
  line: string;
  detail: {
    initials: string;
    color: string;
    studentNo: string;
    event: string;
    statusChip: string;
    tiles: { label: string; value: string; sub: string; subTone?: 'red' | 'muted' }[];
    noteLabel: string;
    note: string;
    similar?: string;
  };
}

export const REVIEW_ITEMS: ReviewItem[] = [
  {
    id: 'r1', kind: 'late', tag: 'LATE SCAN · +7 min', when: '8:22 AM',
    name: 'Fernandez, Paolo R.', course: 'BSED 3-B',
    line: '“Bus broke down — whole block delayed” · L. Tan · SOE',
    detail: {
      initials: 'PF', color: '#e2913f', studentNo: '2023-00552',
      event: 'SG General Assembly', statusChip: 'For review · late scan',
      tiles: [
        { label: 'SCANNED AT', value: '8:22:41 AM', sub: '+7 min after close', subTone: 'red' },
        { label: 'SYNCED AT', value: '8:22:44 AM', sub: 'device online' },
        { label: 'METHOD · SCHOOL', value: 'QR · SOE', sub: 'device CHK-04' },
        { label: 'CHECKER', value: 'L. Tan', sub: 'assigned · SOE' },
      ],
      noteLabel: 'CHECKER NOTE',
      note: '“Bus from Poblacion broke down — the whole BSED 3-B block arrived together around 8:20. Recommending approval.”',
      similar: 'Lim, Hannah C. (+12 min) cites the same incident — review together?',
    },
  },
  {
    id: 'r2', kind: 'late', tag: 'LATE SCAN · +12 min', when: '8:27 AM',
    name: 'Lim, Hannah C.', course: 'BSED 1-A',
    line: 'Same bus incident · L. Tan · SOE',
    detail: {
      initials: 'HL', color: '#3f9bd8', studentNo: '2025-00092',
      event: 'SG General Assembly', statusChip: 'For review · late scan',
      tiles: [
        { label: 'SCANNED AT', value: '8:27:03 AM', sub: '+12 min after close', subTone: 'red' },
        { label: 'SYNCED AT', value: '8:27:06 AM', sub: 'device online' },
        { label: 'METHOD · SCHOOL', value: 'QR · SOE', sub: 'device CHK-04' },
        { label: 'CHECKER', value: 'L. Tan', sub: 'assigned · SOE' },
      ],
      noteLabel: 'CHECKER NOTE',
      note: '“Same Poblacion bus — arrived with the BSED block.”',
      similar: 'Fernandez, Paolo R. (+7 min) cites the same incident — review together?',
    },
  },
  {
    id: 'r3', kind: 'late', tag: 'LATE SCAN · +21 min', when: '8:36 AM',
    name: 'Ocampo, Dave S.', course: 'BSN 2-C',
    line: 'No note attached · S. Diaz · SON',
    detail: {
      initials: 'DO', color: '#8e5fae', studentNo: '2024-01566',
      event: 'SG General Assembly', statusChip: 'For review · late scan',
      tiles: [
        { label: 'SCANNED AT', value: '8:36:12 AM', sub: '+21 min after close', subTone: 'red' },
        { label: 'SYNCED AT', value: '8:36:15 AM', sub: 'device online' },
        { label: 'METHOD · SCHOOL', value: 'QR · SON', sub: 'device CHK-06' },
        { label: 'CHECKER', value: 'S. Diaz', sub: 'assigned · SON' },
      ],
      noteLabel: 'CHECKER NOTE',
      note: 'No note attached by the checker.',
    },
  },
  {
    id: 'r4', kind: 'excuse', tag: 'EXCUSE · medical', when: 'Jul 9',
    name: 'Dela Cruz, Juan Miguel', course: 'BSIT 3-A',
    line: 'Community Cleanup · 1 attachment',
    detail: {
      initials: 'JD', color: '#35a463', studentNo: '2023-01417',
      event: 'Community Cleanup', statusChip: 'Pending · excuse',
      tiles: [
        { label: 'EVENT MISSED', value: 'Jul 8, 2026', sub: 'marked absent' },
        { label: 'FILED', value: 'Jul 9, 2026', sub: 'within 3-day window' },
        { label: 'TYPE', value: 'Medical', sub: '1 attachment' },
        { label: 'FINE AT STAKE', value: '₱50.00', sub: 'waived if approved' },
      ],
      noteLabel: 'STUDENT REASON',
      note: '“I was confined at the campus clinic due to fever. Attached is my medical certificate signed by the school nurse.”',
    },
  },
  {
    id: 'r5', kind: 'excuse', tag: 'EXCUSE · family', when: 'Jul 10',
    name: 'Reyes, Nathan J.', course: 'BSED 3-A',
    line: 'Community Cleanup · 2 attachments',
    detail: {
      initials: 'NR', color: '#3f9bd8', studentNo: '2023-00840',
      event: 'Community Cleanup', statusChip: 'Pending · excuse',
      tiles: [
        { label: 'EVENT MISSED', value: 'Jul 8, 2026', sub: 'marked absent' },
        { label: 'FILED', value: 'Jul 10, 2026', sub: 'within 3-day window' },
        { label: 'TYPE', value: 'Family', sub: '2 attachments' },
        { label: 'FINE AT STAKE', value: '₱50.00', sub: 'waived if approved' },
      ],
      noteLabel: 'STUDENT REASON',
      note: '“We attended my grandfather’s funeral in the province. Attached are the obituary notice and a letter from my parents.”',
    },
  },
];

export type AccountStatus = 'activated' | 'invited' | 'never' | 'deactivated';

export interface AccountRow {
  initials: string;
  color: string;
  name: string;
  email: string;
  studentNo: string;
  course: string;
  status: AccountStatus;
  statusLabel: string;
  lastLogin: string;
  role: 'student' | 'checker' | 'maker';
}

export const ACCOUNTS: AccountRow[] = [
  { initials: 'JD', color: '#35a463', name: 'Dela Cruz, Juan Miguel', email: 'j.delacruz@mvc.edu.ph', studentNo: '2023-01417', course: 'BSIT 3-A', status: 'activated', statusLabel: 'Activated', lastLogin: 'Today 6:41 AM', role: 'student' },
  { initials: 'BG', color: '#e2913f', name: 'Garcia, Bea A.', email: 'b.garcia@mvc.edu.ph', studentNo: '2024-00318', course: 'BSBA 2-A', status: 'activated', statusLabel: 'Activated', lastLogin: 'Yesterday', role: 'student' },
  { initials: 'HL', color: '#3f9bd8', name: 'Lim, Hannah C.', email: 'h.lim@mvc.edu.ph', studentNo: '2025-00092', course: 'BSED 1-A', status: 'invited', statusLabel: 'Invited · Jul 12', lastLogin: '—', role: 'student' },
  { initials: 'DO', color: '#8e5fae', name: 'Ocampo, Dave S.', email: 'd.ocampo@mvc.edu.ph', studentNo: '2024-01566', course: 'BSN 2-C', status: 'never', statusLabel: 'Never logged in', lastLogin: '—', role: 'student' },
  { initials: 'NR', color: '#3f9bd8', name: 'Reyes, Nathan J.', email: 'n.reyes@mvc.edu.ph', studentNo: '2023-00840', course: 'BSED 3-A', status: 'activated', statusLabel: 'Activated', lastLogin: 'Jul 13', role: 'student' },
  { initials: 'ST', color: '#9aa4ad', name: 'Tan, Sofia B.', email: 's.tan@mvc.edu.ph', studentNo: '2021-00233', course: 'BSED 4-B', status: 'deactivated', statusLabel: 'Deactivated', lastLogin: 'Graduated Mar ’26', role: 'student' },
  { initials: 'JR', color: '#35a463', name: 'Ramos, Joel V.', email: 'j.ramos@mvc.edu.ph', studentNo: '—', course: 'SOC', status: 'activated', statusLabel: 'Activated', lastLogin: 'Today 6:02 AM', role: 'checker' },
  { initials: 'LT', color: '#3f9bd8', name: 'Tan, Liza M.', email: 'l.tan@mvc.edu.ph', studentNo: '—', course: 'SOE', status: 'activated', statusLabel: 'Activated', lastLogin: 'Today 6:15 AM', role: 'checker' },
  { initials: 'RU', color: '#8e5fae', name: 'Uy, Rica S.', email: 'r.uy@mvc.edu.ph', studentNo: '—', course: '—', status: 'activated', statusLabel: 'Activated', lastLogin: 'Today 5:48 AM', role: 'maker' },
];

export interface AuditRow {
  time: string;
  actor: string;
  device?: string;
  action: string;
  actionTone: 'green' | 'purple' | 'blue' | 'orange' | 'red' | 'dark';
  record: string;
  change: { kind: 'diff'; from: string; fromTone: string; to: string; toTone: string; note: string } | { kind: 'text'; text: string };
  highlight?: boolean;
}

export const AUDIT_ROWS: AuditRow[] = [
  { time: '8:41:02', actor: 'R. Uy', action: 'APPROVE', actionTone: 'green', record: 'attendance · Fernandez P.', change: { kind: 'diff', from: 'for_review', fromTone: 'orange', to: 'approved', toTone: 'green', note: '“bus delay, verified”' }, highlight: true },
  { time: '8:39:47', actor: 'M. Ferrer', action: 'UPDATE', actionTone: 'purple', record: 'fine · Dela Cruz J.', change: { kind: 'diff', from: 'unpaid ₱50', fromTone: 'orange', to: 'waived', toTone: 'green', note: 'excuse approved' } },
  { time: '8:22:44', actor: 'L. Tan', device: 'CHK-04', action: 'INSERT', actionTone: 'blue', record: 'attendance · Fernandez P.', change: { kind: 'text', text: 'scan in · QR · SOE · scanned 8:22:41' } },
  { time: '8:15:00', actor: 'system', action: 'GENERATE', actionTone: 'dark', record: 'fines · GA 2026', change: { kind: 'text', text: 'window closed → 104 absentees flagged, fines pending excuse review' } },
  { time: '8:09:13', actor: 'J. Ramos', device: 'CHK-02', action: 'INSERT · MANUAL', actionTone: 'orange', record: 'attendance · Estrada M.', change: { kind: 'text', text: 'manual lookup · “ID forgotten” · SOC' } },
  { time: '7:44:31', actor: 'M. Ferrer', action: 'DEACTIVATE', actionTone: 'red', record: 'profile · Tan S.', change: { kind: 'diff', from: 'active', fromTone: 'green', to: 'inactive', toTone: 'gray', note: 'graduated — soft delete' } },
  { time: '6:58:20', actor: 'R. Uy', action: 'INVITE', actionTone: 'blue', record: 'profile · Lim H.', change: { kind: 'text', text: 'activation link sent via email · expires in 7 days' } },
];

export const QR_CARDS = [
  { qr: '/assets/qr-campus.svg', name: 'Dela Cruz,\nJuan Miguel', no: '2023-01417', course: 'BSIT 3-A' },
  { qr: '/assets/qr-campus-2.svg', name: 'Dela Cruz,\nAndrea B.', no: '2024-00281', course: 'BSED 2-B' },
  { qr: '/assets/qr-campus-3.svg', name: 'Dela Rosa,\nRommel T.', no: '2022-01904', course: 'BSN 4-A' },
  { qr: '/assets/qr-campus-4.svg', name: 'Estrada,\nMae S.', no: '2023-00911', course: 'BSIT 3-A' },
];
