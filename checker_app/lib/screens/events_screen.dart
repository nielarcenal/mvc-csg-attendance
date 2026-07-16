import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/live_repo.dart' as repo;
import '../data/scan_store.dart';
import 'scan_screen.dart';
import 'sync_screen.dart';

/// 2b — My events / Event prep: roster cache state, YOUR SCHOOL picker,
/// "Start scanning", roster download for upcoming events. With a backend
/// the assignments (and the school — amendment #1) come from Supabase.
class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  static const _schools = ['SBA', 'SOC', 'SOE'];
  String _school = 'SOC';
  bool _rosterDownloaded = false;
  final _session = ScanSession();
  List<repo.AssignedEvent> _assignments = const [];
  bool _loading = repo.hasBackend;

  repo.AssignedEvent? get _today =>
      _assignments.where((a) => a.openNow).firstOrNull ?? _assignments.firstOrNull;

  @override
  void initState() {
    super.initState();
    if (repo.hasBackend) {
      repo.loadAssignments().then((a) {
        if (!mounted) return;
        setState(() {
          _assignments = a;
          _loading = false;
          if (_today != null) _school = _today!.school;
        });
      }).catchError((_) {
        if (mounted) setState(() => _loading = false);
      });
    }
  }

  Future<void> _startScanning() async {
    if (repo.hasBackend && _today != null) {
      _session.eventName = _today!.name;
      _session.windowLine = _today!.windowLine;
      await _session.startEvent(eventId: _today!.id, school: _today!.school);
    }
    if (!mounted) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ScanScreen(session: _session, school: _school),
    ));
  }

  @override
  Widget build(BuildContext context) {
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
                        onTap: () => Navigator.of(context)
                            .push(MaterialPageRoute(builder: (_) => const SyncScreen())),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(.22),
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text('● ONLINE',
                              style: T.ui(10, weight: FontWeight.w800, color: Colors.white)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                      repo.hasBackend
                          ? 'Signed in as ${repo.checkerName} · Checker'
                          : 'Signed in as J. Ramos · Checker',
                      style: T.ui(11.5, color: Colors.white.withOpacity(.9))),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
              children: [
                // Today's event — roster cached, school picker, start scanning
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
                          Text(
                              repo.hasBackend
                                  ? (_loading ? 'LOADING…' : (_today?.dateLine.toUpperCase() ?? 'NO ASSIGNMENTS'))
                                  : 'TODAY · 7:00 AM',
                              style: T.sectionLabel(color: T.checkerDeep, size: 10)),
                          StatusChip.green('Assigned'),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(repo.hasBackend ? (_today?.name ?? '—') : 'SG General Assembly',
                          style: T.display(18)),
                      const SizedBox(height: 2),
                      Text(
                          repo.hasBackend
                              ? '${_today?.venue ?? ''} · ${_today?.windowLine ?? ''}'
                              : 'MVC Gymnasium · check-in 7:00–8:15 AM',
                          style: T.ui(11, color: T.text2)),
                      const SizedBox(height: 12),
                      Container(
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
                              decoration: const BoxDecoration(color: T.checker, shape: BoxShape.circle),
                              alignment: Alignment.center,
                              child: Text('✓', style: T.ui(14, weight: FontWeight.w800, color: Colors.white)),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    repo.hasBackend
                                        ? 'Roster cached — ${roster.length} students'
                                        : 'Roster cached — 460 students',
                                    style: T.ui(11.5, weight: FontWeight.w800, color: T.checkerDeep)),
                                Text(
                                    repo.hasBackend
                                        ? 'Synced at sign-in · works fully offline'
                                        : 'Updated 6:12 AM · works fully offline',
                                    style: T.ui(10, color: T.text2)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      const SectionLabel('Your school'),
                      const SizedBox(height: 7),
                      if (repo.hasBackend)
                        // Assigned by the event maker — not user-selectable.
                        Row(children: [_schoolPill(_school)])
                      else
                        Row(
                          children: [
                            for (final s in _schools) ...[
                              _schoolPill(s),
                              const SizedBox(width: 7),
                            ],
                            _schoolPill('+5 ▾', more: true),
                          ],
                        ),
                      const SizedBox(height: 14),
                      PillButton('Start scanning →', onTap: _startScanning),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // Other assignments (live) — everything after the active one
                if (repo.hasBackend)
                  for (final a in _assignments.where((a) => a != _today)) ...[
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
                // Upcoming event — roster download (demo mock)
                if (!repo.hasBackend)
                CampusCard(
                  radius: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('FRI JUL 24 · 6:00 PM', style: T.sectionLabel(size: 10)),
                          StatusChip.green('Assigned'),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('Acquaintance Party', style: T.display(15)),
                      const SizedBox(height: 2),
                      Text('Covered Court · check-in 5:30–6:30 PM', style: T.ui(11, color: T.text2)),
                      const SizedBox(height: 11),
                      GestureDetector(
                        onTap: () => setState(() => _rosterDownloaded = true),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          decoration: BoxDecoration(
                            color: _rosterDownloaded ? T.tint(T.checker) : null,
                            border: _rosterDownloaded
                                ? null
                                : Border.all(color: T.student, width: 1.5),
                            borderRadius: BorderRadius.circular(99),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            _rosterDownloaded
                                ? '✓ Roster cached — 460 students'
                                : '↓ Download roster (while online)',
                            style: T.ui(12, weight: FontWeight.w800,
                                color: _rosterDownloaded ? T.checkerDeep : T.studentDeep),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    'Download rosters before heading to the venue — scanning works without signal.',
                    textAlign: TextAlign.center,
                    style: T.ui(10.5, color: T.text2, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _schoolPill(String label, {bool more = false}) {
    final active = !more && _school == label;
    return GestureDetector(
      onTap: more ? null : () => setState(() => _school = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? T.accent : null,
          border: active ? null : Border.all(color: const Color(0xFFD5DCD8), width: 1.5),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          active ? '$label ✓' : label,
          style: T.ui(11,
              weight: active ? FontWeight.w800 : FontWeight.w700,
              color: active ? Colors.white : T.text2),
        ),
      ),
    );
  }
}
