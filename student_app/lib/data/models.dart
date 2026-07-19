/// Data models + the app-wide state populated by live_repo.dart from
/// Supabase after sign-in. Defaults are empty — screens render real empty
/// states until the backend fills these in (no sample data anywhere).
/// The QR encodes the student's `qr_token`, never the student number.
library;

class Student {
  const Student({
    required this.fullName,
    required this.firstName,
    required this.studentNo,
    required this.course,
    required this.qrToken,
    this.qrMode = 'dynamic',
    this.qrActive = true,
  });

  final String fullName;
  final String firstName;
  final String studentNo;
  final String course;
  final String qrToken;

  /// QR v2 (A5): dynamic passes by default; static is admin-assigned.
  final String qrMode; // 'dynamic' | 'static'
  final bool qrActive;

  String get initials {
    final parts = fullName.replaceAll(',', '').trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '·';
    return parts.take(2).map((w) => w[0]).join().toUpperCase();
  }
}

/// The signed-in student; populated by live_repo.refreshAll().
Student currentStudent = const Student(
  fullName: '', firstName: '', studentNo: '', course: '', qrToken: '');

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

HeroEvent? heroEvent;

class EventItem {
  const EventItem({
    this.id,
    required this.name,
    required this.dateLine,
    this.monthTile,
    this.dayTile,
    this.day,
    required this.venue,
    this.windowLine,
    this.closeLabel,
    this.required = true,
    this.rsvpOpen = false,
    this.going,
    this.status = AttendanceStatus.upcoming,
    this.detailLine,
  });

  final String? id; // Supabase event id
  final String name;
  final String dateLine;
  final String? monthTile;
  final String? dayTile;
  final int? day;
  final String venue;
  final String? windowLine; // "7:00 AM – 8:15 AM"
  final String? closeLabel; // "8:15 AM"
  final bool required;
  final bool rsvpOpen;
  final bool? going;
  final AttendanceStatus status;
  final String? detailLine;
}

List<EventItem> upcomingEvents = const [];

/// One event on the calendar, with the student's own status for it.
enum CalStatus { attended, absent, excused, upcoming, optionalPast }

class CalendarEvent {
  const CalendarEvent({
    this.id,
    required this.name,
    required this.line,
    required this.date,
    required this.status,
  });

  final String? id;
  final String name;
  final String line;
  final DateTime date;
  final CalStatus status;
}

List<CalendarEvent> calendarEvents = [];

class HistoryEntry {
  const HistoryEntry({
    this.eventId,
    required this.event,
    required this.line,
    required this.status,
    this.fine,
  });

  final String? eventId;
  final String event;
  final String line;
  final AttendanceStatus status;
  final String? fine;
}

List<HistoryEntry> historyEntries = const [];

class FineEntry {
  const FineEntry({
    required this.event,
    required this.line,
    required this.chip,
    required this.tone,
    this.amount = 0,
  });

  final String event;
  final String line;
  final String chip;
  final String tone; // red (unpaid) | blue (waived) | green (paid)
  final double amount;
}

List<FineEntry> fineEntries = const [];

/// A previously filed excuse, shown at the bottom of the excuse form.
class ExcuseRecord {
  const ExcuseRecord({required this.event, required this.line, required this.status});

  final String event;
  final String line;
  final String status; // pending | approved | rejected
}

List<ExcuseRecord> excuseRecords = const [];

class Announcement {
  const Announcement({required this.title, required this.body});

  final String title;
  final String body;
}

List<Announcement> announcements = const [];

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

  NotificationItem asRead() => NotificationItem(
      kind: kind, title: title, time: time, body: body,
      unread: false, today: today, action: action);
}

List<NotificationItem> notifications = const [];
