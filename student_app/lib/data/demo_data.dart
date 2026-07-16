/// Demo data mirroring the design handoff. When a Supabase backend is
/// configured (--dart-define SUPABASE_URL/SUPABASE_ANON_KEY), live_repo.dart
/// replaces these globals with real rows after sign-in — the screens read
/// the same variables either way. The QR encodes the student's `qr_token`,
/// never the student number.
library;

class Student {
  const Student({
    required this.fullName,
    required this.firstName,
    required this.studentNo,
    required this.course,
    required this.qrToken,
  });

  final String fullName;
  final String firstName;
  final String studentNo;
  final String course;
  final String qrToken;
}

Student demoStudent = const Student(
  fullName: 'Juan Miguel Dela Cruz',
  firstName: 'Juan',
  studentNo: '2023-01417',
  course: 'BSIT 3-A',
  qrToken: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
);

enum AttendanceStatus { present, excused, absent, upcoming }

/// The blue hero card on Home — next required event.
class HeroEvent {
  const HeroEvent({
    this.id,
    required this.label,
    required this.name,
    required this.line,
    this.isRequired = true,
  });

  final String? id;
  final String label; // e.g. "TOMORROW · 7:00 AM"
  final String name;
  final String line; // venue · check-in window
  final bool isRequired;
}

HeroEvent? heroEvent = const HeroEvent(
  label: 'TOMORROW · 7:00 AM',
  name: 'SG General Assembly',
  line: 'MVC Gymnasium · check-in 7:00–8:15 AM',
);

class EventItem {
  const EventItem({
    this.id,
    required this.name,
    required this.dateLine,
    this.monthTile,
    this.dayTile,
    this.day,
    required this.venue,
    this.required = true,
    this.rsvpOpen = false,
    this.going,
    this.status = AttendanceStatus.upcoming,
    this.detailLine,
  });

  final String? id; // Supabase event id (null in demo mode)
  final String name;
  final String dateLine;
  final String? monthTile;
  final String? dayTile;
  final int? day; // day of July 2026 for the calendar grid
  final String venue;
  final bool required;
  final bool rsvpOpen;
  final bool? going;
  final AttendanceStatus status;
  final String? detailLine;
}

List<EventItem> upcomingEvents = const [
  EventItem(
    name: 'Acquaintance Party',
    dateLine: '6:00 PM · Covered Court · Optional',
    monthTile: 'JUL',
    dayTile: '24',
    day: 24,
    venue: 'Covered Court',
    required: false,
    rsvpOpen: true,
  ),
  EventItem(
    name: 'Leadership Summit',
    dateLine: '8:00 AM · AVR Hall · Optional',
    monthTile: 'AUG',
    dayTile: '02',
    venue: 'AVR Hall',
    required: false,
    going: true,
  ),
];

class HistoryEntry {
  const HistoryEntry({
    required this.event,
    required this.line,
    required this.status,
    this.fine,
  });

  final String event;
  final String line;
  final AttendanceStatus status;
  final String? fine;
}

List<HistoryEntry> historyEntries = const [
  HistoryEntry(
    event: 'SG General Assembly',
    line: 'Jul 15 · in 7:42 AM → out 11:03 AM · QR · SOC',
    status: AttendanceStatus.present,
  ),
  HistoryEntry(
    event: 'Community Cleanup',
    line: 'Jul 8 · no scan recorded',
    status: AttendanceStatus.absent,
    fine: '₱50 fine · unpaid',
  ),
  HistoryEntry(
    event: 'Sports Fest — Day 1',
    line: 'Jun 26 · medical excuse approved by R. Uy',
    status: AttendanceStatus.excused,
  ),
  HistoryEntry(
    event: 'Foundation Day Parade',
    line: 'Jun 12 · in 6:58 AM → out 12:10 PM · RFID · SOE',
    status: AttendanceStatus.present,
  ),
];

class FineEntry {
  const FineEntry({required this.event, required this.line, required this.chip, required this.tone});

  final String event;
  final String line;
  final String chip;
  final String tone; // red | blue | green
}

List<FineEntry> fineEntries = const [
  FineEntry(
    event: 'Community Cleanup',
    line: 'Jul 8 · unexcused absence · excuse pending review',
    chip: '₱50 · unpaid',
    tone: 'red',
  ),
  FineEntry(
    event: 'Sports Fest — Day 1',
    line: 'Jun 26 · medical excuse approved → fine waived',
    chip: '₱50 · waived',
    tone: 'blue',
  ),
  FineEntry(
    event: 'Freshman Orientation',
    line: 'Jun 20 · paid at SG office · OR #00214',
    chip: '₱50 · paid',
    tone: 'green',
  ),
];

enum NotificationKind { recorded, reminder, absent, announcement }

class NotificationItem {
  const NotificationItem({
    required this.kind,
    required this.title,
    required this.time,
    required this.body,
    this.unread = false,
    this.today = false,
    this.action,
  });

  final NotificationKind kind;
  final String title;
  final String time;
  final String body;
  final bool unread;
  final bool today;
  final String? action;
}

List<NotificationItem> notifications = const [
  NotificationItem(
    kind: NotificationKind.recorded,
    title: 'Attendance recorded',
    time: '7:42 AM',
    body: 'Time-in at SG General Assembly · SOC · QR',
    unread: true,
    today: true,
  ),
  NotificationItem(
    kind: NotificationKind.reminder,
    title: 'Starting in 1 hour',
    time: '6:00 AM',
    body: 'SG General Assembly · MVC Gym · check-in opens 7:00 AM',
    unread: true,
    today: true,
  ),
  NotificationItem(
    kind: NotificationKind.absent,
    title: 'Marked absent',
    time: 'Jul 8',
    body: 'Community Cleanup · ₱50 fine applies unless excused',
    action: 'File an excuse →',
  ),
  NotificationItem(
    kind: NotificationKind.reminder,
    title: 'Tomorrow, 7:00 AM',
    time: 'Jul 14',
    body: 'Reminder: SG General Assembly · required event',
  ),
  NotificationItem(
    kind: NotificationKind.announcement,
    title: 'Announcement',
    time: 'Jul 13',
    body: 'Excuse letters are now digital — file in-app with a photo',
  ),
];
