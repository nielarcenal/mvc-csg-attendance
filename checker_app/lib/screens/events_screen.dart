import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/live_repo.dart' as repo;
import '../data/scan_store.dart';
import 'login_screen.dart';
import 'scan_screen.dart';
import 'sync_screen.dart';

/// 2b — My events / Event prep: assignments from event_checkers, roster
/// cache state with a real refresh action, "Start scanning".
class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> with WidgetsBindingObserver {
  final _session = ScanSession();
  List<repo.AssignedEvent> _assignments = const [];
  bool _loading = true;
  bool _failed = false;
  bool _refreshingRoster = false;

  repo.AssignedEvent? get _today =>
      _assignments.where((a) => a.openNow).firstOrNull ?? _assignments.firstOrNull;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadAssignments();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Session 11 §D Refresh: re-check assignments when the app comes back
  // to the foreground (sessions may have been edited on the dashboard).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    setState(() { _loading = _assignments.isEmpty; _failed = false; });
    try {
      final a = await repo.loadAssignments();
      if (!mounted) return;
      setState(() { _assignments = a; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _failed = true; });
    }
  }

  Future<void> _confirmSignOut() async {
    final pending = _session.queue
        .where((q) => q.state != SyncState.synced && q.state != SyncState.merged)
        .length;
    final ok = await confirmDialog(
      context,
      title: 'Sign out?',
      body: pending > 0
          ? '$pending scan${pending == 1 ? '' : 's'} not yet synced — signing out '
            'now keeps them queued on this device but stops the upload. Sign out anyway?'
          : "You'll need your password to sign back in.",
      confirmLabel: 'Sign out',
      destructive: pending > 0,
    );
    if (!ok || !mounted) return;
    await repo.signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  Future<void> _downloadRoster() async {
    setState(() => _refreshingRoster = true);
    await repo.refreshRoster();
    if (!mounted) return;
    setState(() => _refreshingRoster = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: T.darkCard,
      content: Text('Roster cached — ${roster.length} students',
          style: T.ui(12, color: Colors.white)),
    ));
  }

  Future<void> _startScanning() async {
    final today = _today;
    if (today == null) return;
    // A3/§D: multi-session events ask which session to scan for; the one
    // whose window contains "now" (or the next upcoming) is the default.
    repo.EventSession? session = today.defaultSession;
    if (today.sessions.length > 1) {
      session = await _pickSession(today);
      if (session == null) return; // sheet dismissed
    }
    await _beginScanning(today, session);
  }

  Future<repo.EventSession?> _pickSession(repo.AssignedEvent event) {
    final fallback = event.defaultSession;
    return showModalBottomSheet<repo.EventSession>(
      context: context,
      backgroundColor: T.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Which session?', style: T.display(17)),
              const SizedBox(height: 2),
              Text(event.name, style: T.ui(11.5, color: T.text2)),
              const SizedBox(height: 12),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final s in event.sessions) ...[
                      GestureDetector(
                        onTap: () => Navigator.of(sheet).pop(s),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: s == fallback ? T.tint(T.checker, .1) : T.bg,
                            border: Border.all(
                                color: s == fallback ? T.checker : Colors.transparent,
                                width: 1.5),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                        s.program.isEmpty
                                            ? '${s.dateLabel} · Attendance check'
                                            : '${s.dateLabel} · ${s.program}',
                                        style: T.ui(12.5, weight: FontWeight.w800)),
                                    const SizedBox(height: 1),
                                    Text(
                                        '${s.windowLine} · '
                                        '${s.inOnly ? 'check-in only' : 'check-in & out'}'
                                        '${s.venue.isNotEmpty ? ' · ${s.venue}' : ''}',
                                        style: T.ui(10.5, color: T.text2)),
                                  ],
                                ),
                              ),
                              if (s.openNow)
                                StatusChip.green('● Open now')
                              else if (s == fallback)
                                StatusChip.green('Next up'),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _beginScanning(
      repo.AssignedEvent event, repo.EventSession? session) async {
    final label = session == null
        ? null
        : '${session.dateLabel}'
            '${session.program.isNotEmpty ? ' · ${session.program}' : ''}';
    _session.eventName = event.name;
    _session.windowLine = session == null
        ? event.windowLine
        : '$label · ${session.windowLine}';
    _session.checkingClosesAt = session?.closesAt ?? event.closesAt;
    await _session.startEvent(
      eventId: event.id,
      school: event.school,
      sessionId: session?.id,
      sessionLabel: label,
      inOnly: session?.inOnly ?? false,
      audienceSchools: event.audienceSchools,
    );
    if (!mounted) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ScanScreen(session: _session, school: event.school),
    ));
  }

  String get _rosterAge {
    final at = rosterSyncedAt;
    if (at == null) return 'not downloaded yet';
    final local = at.toLocal();
    final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
    return 'updated $h:${local.minute.toString().padLeft(2, '0')} ${local.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  Widget build(BuildContext context) {
    final today = _today;
    return Scaffold(
      body: Column(
        children: [
          // Green header
          Container(
            decoration: const BoxDecoration(
              color: T.accent,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(22),
                bottomRight: Radius.circular(22),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
            child: SafeArea(
              bottom: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('My events', style: T.display(18, color: Colors.white)),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => SyncScreen(session: _session))),
                        child: Container(
                          // ≥48px touch target (UX §4)
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(.22),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text('Sync status →',
                                style: T.ui(10, weight: FontWeight.w800, color: Colors.white)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                            repo.checkerName.isEmpty
                                ? 'Signed in · Checker'
                                : 'Signed in as ${repo.checkerName} · Checker',
                            style: T.ui(11.5, color: Colors.white.withOpacity(.9))),
                      ),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _confirmSignOut,
                        child: Padding(
                          // ≥48px touch target (UX §4)
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                          child: Text('Sign out',
                              style: T.ui(10.5,
                                  weight: FontWeight.w700,
                                  color: Colors.white.withOpacity(.8))),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: T.accent,
              onRefresh: _loadAssignments,
              child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
              children: [
                // Session 11 addition #2: offline validation trusts this
                // device's clock — surface real drift loudly.
                if (clockSkewed) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: T.tint(T.alert, .14),
                      border: Border.all(color: T.alert, width: 1.5),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.schedule_rounded, size: 18, color: T.alertDeep),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            'This device’s clock is ${clockSkewSeconds!.abs()}s '
                            '${clockSkewSeconds! > 0 ? 'ahead of' : 'behind'} the server '
                            '(measured at the last roster download). Fix the phone’s '
                            'date & time — scan times and QR-code expiry depend on it.',
                            style: T.ui(11, weight: FontWeight.w600,
                                color: T.alertDeep, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: Center(child: CircularProgressIndicator(color: T.accent)),
                  )
                else if (_failed && _assignments.isEmpty)
                  CampusCard(
                    radius: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
                    child: Column(
                      children: [
                        const Icon(Icons.cloud_off_rounded, size: 28, color: T.muted),
                        const SizedBox(height: 8),
                        Text('Could not load your assignments.',
                            textAlign: TextAlign.center,
                            style: T.ui(12, color: T.text2, height: 1.5)),
                        const SizedBox(height: 12),
                        GhostButton('Retry', onTap: _loadAssignments),
                      ],
                    ),
                  )
                else if (today == null)
                  CampusCard(
                    radius: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
                    child: Center(
                      child: Text(
                        'No assigned events yet.\nThe event maker assigns you from the dashboard.',
                        textAlign: TextAlign.center,
                        style: T.ui(12, color: T.text2, height: 1.6),
                      ),
                    ),
                  )
                else ...[
                  // Active / next event — roster cache + start scanning
                  CampusCard(
                    radius: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                    shadows: T.emphasisShadow,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(today.dateLine.toUpperCase(),
                                style: T.sectionLabel(color: T.checkerDeep, size: 10)),
                            StatusChip.green(today.openNow ? '● Open now' : 'Assigned'),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(today.name, style: T.display(18)),
                        const SizedBox(height: 2),
                        Text('${today.venue} · ${today.windowLine}',
                            style: T.ui(11, color: T.text2)),
                        const SizedBox(height: 12),
                        GestureDetector(
                          onTap: _refreshingRoster ? null : _downloadRoster,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: T.tint(T.checker, .08),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 30,
                                  height: 30,
                                  decoration: BoxDecoration(
                                      color: roster.isEmpty ? T.alert : T.checker,
                                      shape: BoxShape.circle),
                                  alignment: Alignment.center,
                                  child: Text(roster.isEmpty ? '↓' : '✓',
                                      style: T.ui(14, weight: FontWeight.w800, color: Colors.white)),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                          roster.isEmpty
                                              ? 'Roster not cached — tap to download'
                                              : 'Roster cached — ${roster.length} students',
                                          style: T.ui(11.5, weight: FontWeight.w800, color: T.checkerDeep)),
                                      Text(
                                          _refreshingRoster
                                              ? 'Refreshing…'
                                              : '$_rosterAge · tap to refresh · works fully offline',
                                          style: T.ui(10, color: T.text2)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const SectionLabel('Your school'),
                        const SizedBox(height: 7),
                        // Assigned by the event maker — not user-selectable.
                        Row(children: [_schoolPill(today.school)]),
                        const SizedBox(height: 14),
                        PillButton('Start scanning →', onTap: _startScanning),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Other assignments — everything after the active one
                  for (final a in _assignments.where((a) => a != today)) ...[
                    CampusCard(
                      radius: 20,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(a.dateLine.toUpperCase(), style: T.sectionLabel(size: 10)),
                              StatusChip.green('Assigned · ${a.school}'),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(a.name, style: T.display(15)),
                          const SizedBox(height: 2),
                          Text('${a.venue} · ${a.windowLine}', style: T.ui(11, color: T.text2)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'Download rosters before heading to the venue — scanning works without signal.',
                      textAlign: TextAlign.center,
                      style: T.ui(10.5, color: T.text2, height: 1.5),
                    ),
                  ),
                ],
              ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _schoolPill(String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: T.accent,
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          '$label ✓',
          style: T.ui(11, weight: FontWeight.w800, color: Colors.white),
        ),
      );
}
