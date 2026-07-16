import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'live_repo.dart' as repo;

/// Offline-first scan store (spec §3.3).
///
/// The roster is cached locally before the event; every scan validates
/// against the cache, carries a client-generated UUID + `scannedAt`
/// timestamp, and is queued for idempotent upsert to Supabase
/// (`upsert_scan` RPC — earliest scanned_at wins). `scannedAt` decides
/// validity — never the sync time. In demo mode (no backend configured)
/// everything stays in memory and "Simulate next scan" cycles the
/// success → duplicate → unknown states like the interactive prototype.

class RosterEntry {
  const RosterEntry({
    required this.name,
    required this.studentNo,
    required this.course,
    required this.initials,
    required this.colorSeed,
    this.id,
    this.qrToken,
    this.rfidUid,
  });

  final String name;
  final String studentNo;
  final String course;
  final String initials;
  final int colorSeed;
  final String? id; // Supabase students.id
  final String? qrToken;
  final String? rfidUid;
}

/// Mutable: live_repo replaces this with the real roster after sign-in.
List<RosterEntry> roster = const [
  RosterEntry(name: 'Dela Cruz, Juan Miguel', studentNo: '2023-01417', course: 'BSIT 3-A', initials: 'JD', colorSeed: 0),
  RosterEntry(name: 'Dela Cruz, Andrea B.', studentNo: '2024-00281', course: 'BSED 2-B', initials: 'AD', colorSeed: 1),
  RosterEntry(name: 'Dela Rosa, Rommel T.', studentNo: '2022-01904', course: 'BSN 4-A', initials: 'RD', colorSeed: 2),
  RosterEntry(name: 'Navarro, Ella P.', studentNo: '2023-00711', course: 'BSIT 4-A', initials: 'EN', colorSeed: 0),
  RosterEntry(name: 'Chua, Marvin L.', studentNo: '2023-01502', course: 'BSIT 2-B', initials: 'MC', colorSeed: 1),
  RosterEntry(name: 'Torres, Miguel A.', studentNo: '2024-00644', course: 'BSBA 1-A', initials: 'MT', colorSeed: 2),
  RosterEntry(name: 'Garcia, Bea A.', studentNo: '2024-00318', course: 'BSBA 2-A', initials: 'BG', colorSeed: 3),
  RosterEntry(name: 'Abella, Kristine M.', studentNo: '2022-00190', course: 'BSN 3-C', initials: 'KA', colorSeed: 0),
  RosterEntry(name: 'Bautista, Leo P.', studentNo: '2023-00933', course: 'BSED 2-A', initials: 'LB', colorSeed: 1),
];

enum ScanResult { success, duplicate, unknown }

enum SyncState { queued, uploading, synced, merged }

class ScanRecord {
  ScanRecord({
    required this.clientId,
    required this.name,
    required this.time,
    required this.result,
    required this.method,
    this.course,
    this.syncState = SyncState.queued,
  });

  /// Client-generated UUID — makes re-uploads idempotent.
  final String clientId;
  final String name;
  final String time;
  final ScanResult result;
  final String method;
  final String? course;
  SyncState syncState;
}

/// A successful scan waiting to be (re-)uploaded. JSON-serializable so the
/// queue survives app restarts.
class PendingScan {
  PendingScan({
    required this.clientId,
    required this.eventId,
    required this.studentId,
    required this.scanType,
    required this.method,
    required this.scannedAt,
    required this.school,
    this.note,
    this.state = SyncState.queued,
  });

  final String clientId;
  final String eventId;
  final String studentId;
  final String scanType; // 'in' | 'out'
  final String method; // 'qr' | 'rfid' | 'manual'
  final String scannedAt; // ISO-8601, decides validity
  final String school;
  final String? note;
  SyncState state;

  Map<String, dynamic> toJson() => {
        'clientId': clientId, 'eventId': eventId, 'studentId': studentId,
        'scanType': scanType, 'method': method, 'scannedAt': scannedAt,
        'school': school, 'note': note,
      };

  static PendingScan fromJson(Map<String, dynamic> j) => PendingScan(
        clientId: j['clientId'], eventId: j['eventId'], studentId: j['studentId'],
        scanType: j['scanType'], method: j['method'], scannedAt: j['scannedAt'],
        school: j['school'], note: j['note'],
      );
}

String newClientId() {
  final rng = Random.secure();
  String hex(int n) =>
      List.generate(n, (_) => rng.nextInt(16).toRadixString(16)).join();
  return '${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}';
}

const _queueKey = 'scan_queue_v1';

/// Scan session used by the scan + kiosk screens. In demo mode it cycles
/// success → duplicate → unknown like the prototype (3a); with a backend it
/// validates real tokens against the cached roster and syncs through
/// `upsert_scan`.
class ScanSession extends ChangeNotifier {
  bool online = true;
  bool timeIn = true;
  int scanned = 128;
  int queued = 0;
  int dupes = 3;
  int _step = 0;
  int _rosterIx = 0;

  // Live-mode context (set by events_screen before scanning starts).
  String? eventId;
  String? eventName;
  String? windowLine;
  String school = 'SOC';
  String deviceId = 'CHK-01';
  final Set<String> _scannedIn = {}; // student ids seen this session (in)
  final Set<String> _scannedOut = {};
  final List<PendingScan> queue = [];

  ScanRecord? current;
  final List<ScanRecord> recent = [];

  bool get live => repo.hasBackend;

  /// Whether this student already has an in/out scan this session
  /// (used by manual lookup to show real scan state).
  bool hasScanned(String? studentId, {bool timeInType = true}) =>
      studentId != null && (timeInType ? _scannedIn : _scannedOut).contains(studentId);

  Future<void> startEvent({
    required String eventId,
    required String school,
  }) async {
    this.eventId = eventId;
    this.school = school;
    scanned = 0;
    dupes = 0;
    _scannedIn.clear();
    _scannedOut.clear();
    await _restoreQueue();
    // Warm counters from what the server already has for this event.
    try {
      final rows = List<Map<String, dynamic>>.from(await repo.client
          .from('attendance')
          .select('student_id, scan_type')
          .eq('event_id', eventId));
      for (final r in rows) {
        if (r['scan_type'] == 'in') _scannedIn.add(r['student_id'] as String);
        if (r['scan_type'] == 'out') _scannedOut.add(r['student_id'] as String);
      }
      scanned = _scannedIn.length;
    } catch (_) {/* offline start — counters warm up as we scan */}
    notifyListeners();
  }

  void toggleOnline() {
    online = !online;
    if (online) {
      if (live) {
        flush();
      } else if (queued > 0) {
        queued = 0; // demo: auto-sync on reconnect
      }
    }
    notifyListeners();
  }

  void setTimeIn(bool v) {
    timeIn = v;
    notifyListeners();
  }

  String _clock(DateTime now) {
    final hour12 = now.hour % 12 == 0 ? 12 : now.hour % 12;
    return '$hour12:${now.minute.toString().padLeft(2, '0')}';
  }

  /// Camera/RFID/simulated entry point in live mode. The QR payload is
  /// `<qr_token>` or `<qr_token>:<epoch>` (rotating student ID).
  Future<void> recordToken(String raw, {String method = 'qr'}) async {
    final token = raw.split(':').first.trim();
    final entry = roster
        .where((r) => r.qrToken == token || (r.rfidUid != null && r.rfidUid == token))
        .toList();
    if (entry.isEmpty) {
      _feedback(null, ScanResult.unknown, method);
      return;
    }
    await recordStudent(entry.first, method: method);
  }

  /// Manual-lookup / camera-confirmed entry point in live mode.
  Future<void> recordStudent(RosterEntry entry, {String method = 'qr', String? note}) async {
    if (!live || eventId == null || entry.id == null) {
      _feedback(entry, ScanResult.success, method);
      return;
    }
    final seen = timeIn ? _scannedIn : _scannedOut;
    if (seen.contains(entry.id)) {
      _feedback(entry, ScanResult.duplicate, method);
      return;
    }
    seen.add(entry.id!);
    final scan = PendingScan(
      clientId: newClientId(),
      eventId: eventId!,
      studentId: entry.id!,
      scanType: timeIn ? 'in' : 'out',
      method: method,
      scannedAt: DateTime.now().toUtc().toIso8601String(),
      school: school,
      note: note,
    );
    queue.add(scan);
    await _persistQueue();
    _feedback(entry, ScanResult.success, method);
    if (online) await flush();
  }

  void _feedback(RosterEntry? entry, ScanResult result, String method) {
    final record = ScanRecord(
      clientId: newClientId(),
      name: entry?.name ?? 'Unknown code',
      time: _clock(DateTime.now()),
      result: result,
      method: method.toUpperCase() == 'QR' ? 'QR' : method[0].toUpperCase() + method.substring(1),
      course: entry?.course,
    );
    current = record;
    if (result == ScanResult.success) {
      scanned++;
      if (live) {
        queued = queue
            .where((q) => q.state != SyncState.synced && q.state != SyncState.merged)
            .length;
      } else if (!online) {
        queued++;
      }
    } else if (result == ScanResult.duplicate) {
      dupes++;
    }
    recent.insert(0, record);
    if (recent.length > 6) recent.removeLast();
    notifyListeners();
  }

  /// Upload everything still pending via the idempotent upsert RPC.
  Future<void> flush() async {
    if (!live || !online) return;
    for (final scan in queue.where((q) => q.state != SyncState.synced).toList()) {
      scan.state = SyncState.uploading;
      notifyListeners();
      try {
        await repo.client.rpc('upsert_scan', params: {
          'p_id': scan.clientId,
          'p_event': scan.eventId,
          'p_student': scan.studentId,
          'p_type': scan.scanType,
          'p_method': scan.method,
          'p_scanned': scan.scannedAt,
          'p_checker': repo.client.auth.currentUser?.id,
          'p_device': deviceId,
          'p_school': scan.school,
          'p_note': scan.note,
        });
        scan.state = SyncState.synced;
      } on PostgrestException catch (e) {
        // Unique-conflict merge = another device got there first; that is
        // success (earliest scan wins server-side). Anything else: keep it.
        if (e.code == '23505') {
          scan.state = SyncState.merged;
        } else {
          scan.state = SyncState.queued;
        }
      } catch (_) {
        scan.state = SyncState.queued; // network — retry later
      }
      notifyListeners();
    }
    queue.removeWhere((q) => q.state == SyncState.synced || q.state == SyncState.merged);
    await _persistQueue();
    queued = queue.length;
    notifyListeners();
  }

  Future<void> _persistQueue() async {
    if (!live) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_queueKey, jsonEncode(queue.map((q) => q.toJson()).toList()));
  }

  Future<void> _restoreQueue() async {
    if (!live) return;
    final prefs = await SharedPreferences.getInstance();
    final rawQueue = prefs.getString(_queueKey);
    if (rawQueue == null) return;
    queue
      ..clear()
      ..addAll((jsonDecode(rawQueue) as List)
          .map((j) => PendingScan.fromJson(Map<String, dynamic>.from(j))));
    queued = queue.length;
  }

  /// Demo/prototype behavior; in live mode it scans the next real roster
  /// member's token so the flow can be exercised without a camera.
  void simulateScan() {
    if (live) {
      final withTokens = roster.where((r) => r.qrToken != null).toList();
      if (withTokens.isEmpty) return;
      recordToken(withTokens[_rosterIx++ % withTokens.length].qrToken!);
      return;
    }
    final result = switch (_step % 3) {
      0 => ScanResult.success,
      1 => ScanResult.duplicate,
      _ => ScanResult.unknown,
    };
    _step++;
    final entry = roster[_rosterIx % roster.length];
    if (result == ScanResult.success) _rosterIx++;
    _feedback(result == ScanResult.unknown ? null : entry, result, 'QR');
  }

  void reset() {
    scanned = live ? 0 : 128;
    queued = live ? queue.length : 0;
    dupes = live ? 0 : 3;
    _step = 0;
    _rosterIx = 0;
    current = null;
    recent.clear();
    notifyListeners();
  }
}
