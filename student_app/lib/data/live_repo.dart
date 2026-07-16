/// Supabase wiring for the student app.
///
/// Configure at build/run time:
///   flutter run --dart-define=SUPABASE_URL=https://xxx.supabase.co \
///               --dart-define=SUPABASE_ANON_KEY=eyJ...
/// Without the defines the app stays in demo mode (demo_data.dart).
library;

import 'package:supabase_flutter/supabase_flutter.dart';
import 'demo_data.dart';

const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
const hasBackend = supabaseUrl != '' && supabaseAnonKey != '';

SupabaseClient get _db => Supabase.instance.client;

Future<void> initSupabase() async {
  if (!hasBackend) return;
  // We pass the project's legacy anon key, which remains supported.
  // ignore: deprecated_member_use
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
}

/// Returns an error message, or null on success.
Future<String?> signIn(String email, String password) async {
  if (!hasBackend) return null;
  try {
    await _db.auth.signInWithPassword(email: email, password: password);
    await refreshAll();
    return null;
  } on AuthException catch (e) {
    return e.message;
  } catch (e) {
    return 'Could not sign in: $e';
  }
}

bool get isSignedIn => !hasBackend || _db.auth.currentSession != null;

Future<void> signOut() async {
  if (hasBackend) await _db.auth.signOut();
}

// ── formatting ──────────────────────────────────────────────────────
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _monthsUp = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

String _time(DateTime d) {
  final local = d.toLocal();
  final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final m = local.minute.toString().padLeft(2, '0');
  return '$h:$m ${local.hour < 12 ? 'AM' : 'PM'}';
}

String _date(DateTime d) => '${_months[d.toLocal().month - 1]} ${d.toLocal().day}';

// ── load everything the screens read ────────────────────────────────
Future<void> refreshAll() async {
  final uid = _db.auth.currentUser?.id;
  if (uid == null) return;

  final profile =
      await _db.from('profiles').select('full_name, email').eq('id', uid).single();
  final student = await _db
      .from('students')
      .select('id, student_no, full_name, course, year_level, section, qr_token')
      .eq('profile_id', uid)
      .maybeSingle();

  final fullName = (student?['full_name'] ?? profile['full_name']) as String;
  // "Dela Cruz, Juan Miguel" → first name "Juan"
  final firstName = fullName.contains(',')
      ? fullName.split(',').last.trim().split(' ').first
      : fullName.split(' ').first;
  demoStudent = Student(
    fullName: fullName.contains(',')
        ? '${fullName.split(',').last.trim()} ${fullName.split(',').first.trim()}'
        : fullName,
    firstName: firstName,
    studentNo: (student?['student_no'] ?? '—') as String,
    course: student == null
        ? '—'
        : '${student['course'] ?? ''} ${student['year_level'] ?? ''}-${student['section'] ?? ''}'.trim(),
    qrToken: (student?['qr_token'] ?? '') as String,
  );
  final studentId = student?['id'] as String?;

  final events = List<Map<String, dynamic>>.from(
      await _db.from('events').select('*').order('starts_at'));
  final rsvps = studentId == null
      ? <Map<String, dynamic>>[]
      : List<Map<String, dynamic>>.from(await _db
          .from('event_rsvps')
          .select('event_id, going')
          .eq('student_id', studentId));
  final scans = studentId == null
      ? <Map<String, dynamic>>[]
      : List<Map<String, dynamic>>.from(await _db
          .from('attendance')
          .select('event_id, scan_type, method, status, scanned_at, school')
          .eq('student_id', studentId));
  final myFines = studentId == null
      ? <Map<String, dynamic>>[]
      : List<Map<String, dynamic>>.from(await _db
          .from('fines')
          .select('event_id, amount, status, or_number, created_at')
          .eq('student_id', studentId));
  final myExcuses = studentId == null
      ? <Map<String, dynamic>>[]
      : List<Map<String, dynamic>>.from(await _db
          .from('excuses')
          .select('event_id, status, filed_at')
          .eq('student_id', studentId));

  final now = DateTime.now();
  final byId = {for (final e in events) e['id'] as String: e};
  DateTime ts(Map e, String k) => DateTime.parse(e[k] as String).toLocal();

  // Upcoming = events that haven't ended yet.
  final upcoming = events.where((e) => ts(e, 'ends_at').isAfter(now)).toList();
  upcomingEvents = upcoming.map((e) {
    final starts = ts(e, 'starts_at');
    final rsvp = rsvps.where((r) => r['event_id'] == e['id']).toList();
    final isRequired = e['is_required'] as bool;
    return EventItem(
      id: e['id'] as String,
      name: e['name'] as String,
      dateLine:
          '${_time(starts)} · ${e['venue'] ?? ''} · ${isRequired ? 'Required' : 'Optional'}',
      monthTile: _monthsUp[starts.month - 1],
      dayTile: starts.day.toString().padLeft(2, '0'),
      day: starts.day,
      venue: (e['venue'] ?? '') as String,
      required: isRequired,
      rsvpOpen: !isRequired && rsvp.isEmpty,
      going: rsvp.isEmpty ? null : rsvp.first['going'] as bool,
    );
  }).toList();

  // Hero card = next required upcoming event (else next event).
  final hero = upcoming.where((e) => e['is_required'] as bool).toList();
  final heroSrc = hero.isNotEmpty ? hero.first : (upcoming.isNotEmpty ? upcoming.first : null);
  if (heroSrc == null) {
    heroEvent = null;
  } else {
    final starts = ts(heroSrc, 'starts_at');
    final opens = ts(heroSrc, 'checking_opens_at');
    final closes = ts(heroSrc, 'checking_closes_at');
    final dayDiff = DateTime(starts.year, starts.month, starts.day)
        .difference(DateTime(now.year, now.month, now.day))
        .inDays;
    final dayWord = dayDiff <= 0 ? 'TODAY' : (dayDiff == 1 ? 'TOMORROW' : _date(starts).toUpperCase());
    heroEvent = HeroEvent(
      id: heroSrc['id'] as String,
      label: '$dayWord · ${_time(starts)}',
      name: heroSrc['name'] as String,
      line: '${heroSrc['venue'] ?? ''} · check-in ${_time(opens)}–${_time(closes)}',
      isRequired: heroSrc['is_required'] as bool,
    );
  }

  // History = past events, newest first.
  final past = events.where((e) => !ts(e, 'ends_at').isAfter(now)).toList().reversed;
  historyEntries = past.map((e) {
    final id = e['id'];
    final inScan = scans.where((s) =>
        s['event_id'] == id && s['scan_type'] == 'in' &&
        (s['status'] == 'valid' || s['status'] == 'approved')).toList();
    final outScan =
        scans.where((s) => s['event_id'] == id && s['scan_type'] == 'out').toList();
    final excuse = myExcuses.where((x) => x['event_id'] == id).toList();
    final fine = myFines.where((f) => f['event_id'] == id).toList();
    final when = _date(ts(e, 'starts_at'));
    if (inScan.isNotEmpty) {
      final s = inScan.first;
      final inAt = _time(DateTime.parse(s['scanned_at'] as String));
      final outPart = outScan.isEmpty
          ? ''
          : ' → out ${_time(DateTime.parse(outScan.first['scanned_at'] as String))}';
      return HistoryEntry(
        event: e['name'] as String,
        line: '$when · in $inAt$outPart · ${(s['method'] as String).toUpperCase()} · ${s['school']}',
        status: AttendanceStatus.present,
      );
    }
    if (excuse.any((x) => x['status'] == 'approved')) {
      return HistoryEntry(
        event: e['name'] as String,
        line: '$when · excuse approved',
        status: AttendanceStatus.excused,
      );
    }
    if (!(e['is_required'] as bool)) {
      return HistoryEntry(
        event: e['name'] as String,
        line: '$when · optional · no scan',
        status: AttendanceStatus.upcoming,
      );
    }
    final fineNote = fine.isEmpty
        ? null
        : '₱${(fine.first['amount'] as num).toStringAsFixed(0)} fine · ${fine.first['status']}';
    return HistoryEntry(
      event: e['name'] as String,
      line: '$when · no scan recorded',
      status: AttendanceStatus.absent,
      fine: fineNote,
    );
  }).toList();

  fineEntries = myFines.reversed.map((f) {
    final e = byId[f['event_id']];
    final status = f['status'] as String;
    final when = e == null ? '' : _date(ts(e, 'starts_at'));
    final amount = '₱${(f['amount'] as num).toStringAsFixed(0)}';
    switch (status) {
      case 'paid':
        return FineEntry(
          event: (e?['name'] ?? 'Event') as String,
          line: '$when · paid at SG office${f['or_number'] != null ? ' · OR #${f['or_number']}' : ''}',
          chip: '$amount · paid',
          tone: 'green',
        );
      case 'waived':
        return FineEntry(
          event: (e?['name'] ?? 'Event') as String,
          line: '$when · excuse approved → fine waived',
          chip: '$amount · waived',
          tone: 'blue',
        );
      default:
        final pending = myExcuses.any(
            (x) => x['event_id'] == f['event_id'] && x['status'] == 'pending');
        return FineEntry(
          event: (e?['name'] ?? 'Event') as String,
          line: '$when · unexcused absence${pending ? ' · excuse pending review' : ''}',
          chip: '$amount · unpaid',
          tone: 'red',
        );
    }
  }).toList();

  // Notifications synthesized from my records (push comes later via FCM).
  final notifs = <NotificationItem>[];
  for (final s in scans.take(3)) {
    final e = byId[s['event_id']];
    final at = DateTime.parse(s['scanned_at'] as String).toLocal();
    final today = at.day == now.day && at.month == now.month && at.year == now.year;
    notifs.add(NotificationItem(
      kind: NotificationKind.recorded,
      title: 'Attendance recorded',
      time: today ? _time(at) : _date(at),
      body:
          'Time-${s['scan_type']} at ${e?['name'] ?? 'event'} · ${s['school']} · ${(s['method'] as String).toUpperCase()}',
      unread: today,
      today: today,
    ));
  }
  if (heroEvent != null) {
    notifs.add(NotificationItem(
      kind: NotificationKind.reminder,
      title: heroEvent!.label.contains('TODAY') ? 'Happening today' : 'Coming up',
      time: '',
      body: '${heroEvent!.name} · ${heroEvent!.line}',
    ));
  }
  for (final h in historyEntries.where((h) => h.status == AttendanceStatus.absent).take(2)) {
    notifs.add(NotificationItem(
      kind: NotificationKind.absent,
      title: 'Marked absent',
      time: '',
      body: '${h.event} · ${h.fine ?? 'fine applies unless excused'}',
      action: 'File an excuse →',
    ));
  }
  notifications = notifs;
}

// ── writes ──────────────────────────────────────────────────────────
Future<String?> setRsvp(String? eventId, bool going) async {
  if (!hasBackend || eventId == null) return null;
  try {
    final student = await _db
        .from('students')
        .select('id')
        .eq('profile_id', _db.auth.currentUser!.id)
        .single();
    await _db.from('event_rsvps').upsert({
      'event_id': eventId,
      'student_id': student['id'],
      'going': going,
    });
    await refreshAll();
    return null;
  } catch (e) {
    return 'Could not save RSVP: $e';
  }
}

Future<String?> submitExcuse(String? eventId, String reason) async {
  if (!hasBackend) return null;
  try {
    final student = await _db
        .from('students')
        .select('id')
        .eq('profile_id', _db.auth.currentUser!.id)
        .single();
    String? targetEvent = eventId;
    if (targetEvent == null) {
      // Default to the most recent required event the student missed.
      final absent = historyEntries
          .where((h) => h.status == AttendanceStatus.absent)
          .toList();
      if (absent.isEmpty) return 'No missed event to excuse.';
      final events = List<Map<String, dynamic>>.from(await _db
          .from('events')
          .select('id, name')
          .eq('name', absent.first.event)
          .limit(1));
      if (events.isEmpty) return 'Could not find the event.';
      targetEvent = events.first['id'] as String;
    }
    await _db.from('excuses').insert({
      'student_id': student['id'],
      'event_id': targetEvent,
      'reason': reason,
    });
    await refreshAll();
    return null;
  } catch (e) {
    return 'Could not submit excuse: $e';
  }
}
