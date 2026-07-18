// Shared row shapes for the dashboard pages. All data comes from Supabase
// (see api.ts) — there are no sample rows; pages render real empty states.

// Institutional config: the university's schools. Checkers are assigned per
// school and the school tag rides on every scan record (spec amendment #1).
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

export type ReviewKind = 'late' | 'excuse';

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  tag: string; // e.g. "LATE SCAN · +7 min" | "EXCUSE · pending"
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

export interface AuditRow {
  time: string;
  actor: string;
  device?: string;
  action: string;
  actionTone: 'green' | 'purple' | 'blue' | 'orange' | 'red' | 'dark';
  record: string;
  table: string;
  change: { kind: 'diff'; from: string; fromTone: string; to: string; toTone: string; note: string } | { kind: 'text'; text: string };
  highlight?: boolean;
}
