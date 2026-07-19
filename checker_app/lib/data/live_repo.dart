/// Supabase wiring for the checker app.
///
/// Configure at build/run time:
///   flutter run --dart-define=SUPABASE_URL=https://xxx.supabase.co \
///               --dart-define=SUPABASE_ANON_KEY=eyJ...
/// Without the defines the app stays in demo mode.
library;

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'scan_store.dart';

const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
const hasBackend = supabaseUrl != '' && supabaseAnonKey != '';

SupabaseClient get client => Supabase.instance.client;

Future<void> initSupabase() async {
  if (!hasBackend) return;
  // We pass the project's legacy anon key, which remains supported.
  // ignore: deprecated_member_use
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
}

String checkerName = '';

bool get isSignedIn => hasBackend && client.auth.currentSession != null;

Future<void> signOut() async {
  if (hasBackend) await client.auth.signOut();
}

/// Reloads profile + roster for a persisted session. Returns false when the
/// stored session belongs to a non-checker account. Offline, it falls back
/// to the persisted roster cache so scanning keeps working.
Future<bool> restoreSession() async {
  final uid = client.auth.currentUser?.id;
  if (uid == null) return false;
  try {
    final profile =
        await client.from('profiles').select('full_name, role').eq('id', uid).single();
    if (profile['role'] != 'checker' &&
        profile['role'] != 'event_maker' &&
        profile['role'] != 'super_admin') {
      await client.auth.signOut();
      return false;
    }
    checkerName = profile['full_name'] as String;
    await refreshRoster();
  } catch (_) {
    // Network unavailable — trust the stored session and the cached roster.
    await restoreRoster();
  }
  return true;
}

/// Returns an error message, or null on success.
Future<String?> signIn(String email, String password) async {
  if (!hasBackend) {
    return 'App not configured — build with SUPABASE_URL and SUPABASE_ANON_KEY.';
  }
  try {
    await client.auth.signInWithPassword(email: email, password: password);
    final profile = await client
        .from('profiles')
        .select('full_name, role')
        .eq('id', client.auth.currentUser!.id)
        .single();
    if (profile['role'] != 'checker' &&
        profile['role'] != 'event_maker' &&
        profile['role'] != 'super_admin') {
      await client.auth.signOut();
      return 'This account has no checker access.';
    }
    checkerName = profile['full_name'] as String;
    await refreshRoster();
    return null;
  } on AuthException catch (e) {
    return e.message;
  } catch (e) {
    return 'Could not sign in: $e';
  }
}

/// One checking session of an event (FEATURE_BATCH_2 A3/§D) — the scan
/// screen records against a session, not the whole event.
class EventSession {
  const EventSession({
    required this.id,
    required this.opensAt,
    required this.closesAt,
    required this.program,
    required this.venue,
    required this.inOnly,
    required this.dateLabel,
    required this.windowLine,
  });

  final String id;
  final DateTime opensAt;
  final DateTime closesAt;
  final String program; // '' when unnamed
  final String venue;
  final bool inOnly;    // in_only sessions have no time-out
  final String dateLabel;   // "Jul 21"
  final String windowLine;  // "8:00 AM – 10:00 AM"

  bool get openNow {
    final now = DateTime.now();
    return !now.isBefore(opensAt) && !now.isAfter(closesAt);
  }
}

class AssignedEvent {
  const AssignedEvent({
    required this.id,
    required this.name,
    required this.venue,
    required this.dateLine,
    required this.windowLine,
    required this.school,
    required this.openNow,
    required this.closesAt,
    this.sessions = const [],
    this.audienceSchools,
  });

  final String id;
  final String name;
  final String venue;
  final String dateLine;
  final String windowLine;
  final String school; // the school this checker covers (amendment #1)
  final bool openNow;
  final DateTime closesAt; // checking window close — late scans go for review

  /// Ordered checking sessions; empty only for legacy events without rows.
  final List<EventSession> sessions;

  /// A4 audience: school codes when by_school, null = all students.
  final List<String>? audienceSchools;

  /// The session a checker most likely wants right now: the one whose
  /// window contains "now", else the next upcoming, else the last.
  EventSession? get defaultSession {
    if (sessions.isEmpty) return null;
    final now = DateTime.now();
    for (final s in sessions) {
      if (s.openNow) return s;
    }
    for (final s in sessions) {
      if (s.opensAt.isAfter(now)) return s;
    }
    return sessions.last;
  }
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _time(DateTime d) {
  final l = d.toLocal();
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  return '$h:${l.minute.toString().padLeft(2, '0')} ${l.hour < 12 ? 'AM' : 'PM'}';
}

const _assignmentsKey = 'assignments_cache_v1';

/// Assignments (with their sessions + audience) persist alongside the
/// roster so the session picker works after an offline restart. The cache
/// is overwritten on every successful load — a session edited on the
/// dashboard replaces the stale copy on the next refresh (§D cache
/// invalidation).
Future<List<AssignedEvent>> loadAssignments() async {
  if (!hasBackend) return const [];
  List<Map<String, dynamic>> rows;
  try {
    rows = List<Map<String, dynamic>>.from(await client
        .from('event_checkers')
        .select('school, events(*, event_sessions(*), event_schools(school_code))')
        .eq('profile_id', client.auth.currentUser!.id));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_assignmentsKey, jsonEncode(rows));
  } catch (_) {
    // Offline — the last cached assignments still allow scanning.
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_assignmentsKey);
    if (raw == null) rethrow;
    rows = (jsonDecode(raw) as List)
        .map((r) => Map<String, dynamic>.from(r as Map))
        .toList();
  }
  return _parseAssignments(rows);
}

List<AssignedEvent> _parseAssignments(List<Map<String, dynamic>> rows) {
  final now = DateTime.now();
  return rows.where((r) => r['events'] != null).map((r) {
    final e = Map<String, dynamic>.from(r['events'] as Map);
    final starts = DateTime.parse(e['starts_at'] as String).toLocal();
    final opens = DateTime.parse(e['checking_opens_at'] as String).toLocal();
    final closes = DateTime.parse(e['checking_closes_at'] as String).toLocal();
    final ends = DateTime.parse(e['ends_at'] as String).toLocal();
    final sessions = ((e['event_sessions'] as List?) ?? const [])
        .map((s) => Map<String, dynamic>.from(s as Map))
        .map((s) {
          final sOpens = DateTime.parse(s['checking_opens_at'] as String).toLocal();
          final sCloses = DateTime.parse(s['checking_closes_at'] as String).toLocal();
          return EventSession(
            id: s['id'] as String,
            opensAt: sOpens,
            closesAt: sCloses,
            program: (s['program'] ?? '') as String,
            venue: (s['venue'] ?? '') as String,
            inOnly: s['mode'] == 'in_only',
            dateLabel: '${_months[sOpens.month - 1]} ${sOpens.day}',
            windowLine: '${_time(sOpens)} – ${_time(sCloses)}',
          );
        })
        .toList()
      ..sort((a, b) => a.opensAt.compareTo(b.opensAt));
    final audience = e['audience_type'] == 'by_school'
        ? ((e['event_schools'] as List?) ?? const [])
            .map((s) => (s as Map)['school_code'] as String)
            .toList()
        : null;
    return AssignedEvent(
      id: e['id'] as String,
      name: e['name'] as String,
      venue: (e['venue'] ?? '') as String,
      dateLine: '${_months[starts.month - 1]} ${starts.day} · ${_time(starts)}',
      windowLine: 'Check-in ${_time(opens)} – ${_time(closes)}',
      school: r['school'] as String,
      openNow: now.isAfter(opens) && now.isBefore(ends),
      closesAt: closes,
      sessions: sessions,
      audienceSchools: audience,
    );
  }).toList()
    ..sort((a, b) => (b.openNow ? 1 : 0) - (a.openNow ? 1 : 0));
}

/// Downloads the full active roster into the local cache used for offline
/// validation (spec §3.3) and persists it so it survives app restarts.
/// Falls back to the persisted cache when the network is unavailable.
Future<void> refreshRoster() async {
  if (!hasBackend) return;
  final List<Map<String, dynamic>> rows;
  try {
    rows = List<Map<String, dynamic>>.from(await client
        .from('students')
        .select('id, student_no, full_name, course, year_level, section, '
            'school_id, qr_token, rfid_uid, qr_active, qr_expires_at')
        .eq('active', true)
        .order('full_name'));
    // The ed25519 public key rides with the roster bundle so dynamic
    // passes verify fully offline (A5).
    final keyRow = await client
        .from('settings').select('value').eq('key', 'qr_public_key').maybeSingle();
    final key = keyRow?['value'];
    if (key is String && key.isNotEmpty) qrPublicKey = key;
    // Session 11 addition #2: stamp the server clock with the download.
    // Offline validation trusts the device clock (pass expiry, scan
    // times) — a drifted clock gets a visible warning, not silent damage.
    try {
      final serverNow = DateTime.parse((await client.rpc('server_time')) as String);
      clockSkewSeconds =
          DateTime.now().toUtc().difference(serverNow.toUtc()).inSeconds;
    } catch (_) {/* rpc unavailable — keep the last measured skew */}
  } catch (_) {
    await restoreRoster(); // offline — use the last cached roster
    return;
  }
  String initialsOf(String name) {
    final parts = name.replaceAll(',', '').split(RegExp(r'\s+'));
    return ((parts.isNotEmpty ? parts[0][0] : '') +
            (parts.length > 1 ? parts[1][0] : ''))
        .toUpperCase();
  }

  roster = rows
      .map((s) => RosterEntry(
            id: s['id'] as String,
            name: s['full_name'] as String,
            studentNo: s['student_no'] as String,
            course:
                '${s['course'] ?? ''} ${s['year_level'] ?? ''}-${s['section'] ?? ''}'.trim(),
            initials: initialsOf(s['full_name'] as String),
            colorSeed: (s['student_no'] as String).hashCode % 4,
            schoolId: s['school_id'] as String?,
            qrToken: s['qr_token'] as String?,
            rfidUid: s['rfid_uid'] as String?,
            qrActive: (s['qr_active'] as bool?) ?? true,
            qrExpiresAt: s['qr_expires_at'] as String?,
          ))
      .toList();
  rosterSyncedAt = DateTime.now();
  await persistRoster();
}
