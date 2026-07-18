/// Supabase wiring for the checker app.
///
/// Configure at build/run time:
///   flutter run --dart-define=SUPABASE_URL=https://xxx.supabase.co \
///               --dart-define=SUPABASE_ANON_KEY=eyJ...
/// Without the defines the app stays in demo mode.
library;

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
  });

  final String id;
  final String name;
  final String venue;
  final String dateLine;
  final String windowLine;
  final String school; // the school this checker covers (amendment #1)
  final bool openNow;
  final DateTime closesAt; // checking window close — late scans go for review
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _time(DateTime d) {
  final l = d.toLocal();
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  return '$h:${l.minute.toString().padLeft(2, '0')} ${l.hour < 12 ? 'AM' : 'PM'}';
}

Future<List<AssignedEvent>> loadAssignments() async {
  if (!hasBackend) return const [];
  final rows = List<Map<String, dynamic>>.from(await client
      .from('event_checkers')
      .select('school, events(*)')
      .eq('profile_id', client.auth.currentUser!.id));
  final now = DateTime.now();
  final events = rows.where((r) => r['events'] != null).map((r) {
    final e = r['events'] as Map<String, dynamic>;
    final starts = DateTime.parse(e['starts_at'] as String).toLocal();
    final opens = DateTime.parse(e['checking_opens_at'] as String).toLocal();
    final closes = DateTime.parse(e['checking_closes_at'] as String).toLocal();
    final ends = DateTime.parse(e['ends_at'] as String).toLocal();
    return AssignedEvent(
      id: e['id'] as String,
      name: e['name'] as String,
      venue: (e['venue'] ?? '') as String,
      dateLine: '${_months[starts.month - 1]} ${starts.day} · ${_time(starts)}',
      windowLine: 'Check-in ${_time(opens)} – ${_time(closes)}',
      school: r['school'] as String,
      openNow: now.isAfter(opens) && now.isBefore(ends),
      closesAt: closes,
    );
  }).toList()
    ..sort((a, b) => (b.openNow ? 1 : 0) - (a.openNow ? 1 : 0));
  return events;
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
        .select('id, student_no, full_name, course, year_level, section, qr_token, rfid_uid')
        .eq('active', true)
        .order('full_name'));
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
            qrToken: s['qr_token'] as String?,
            rfidUid: s['rfid_uid'] as String?,
          ))
      .toList();
  rosterSyncedAt = DateTime.now();
  await persistRoster();
}
