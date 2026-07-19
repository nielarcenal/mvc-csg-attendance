import 'package:flutter/material.dart';
import '../data/models.dart';
import '../data/live_repo.dart' as repo;
import '../theme.dart';
import 'home_shell.dart';

/// 6a — Event detail: blue header, info rows, RSVP block (optional events
/// only), reminders note, "Open my ID" CTA. Renders the real [EventItem]
/// passed in — callers must not navigate here without one.
class EventDetailScreen extends StatefulWidget {
  const EventDetailScreen({super.key, required this.event});

  final EventItem event;

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  bool? _going;
  int _headcount = 0;
  List<repo.EventSessionInfo> _sessions = const [];

  EventItem get e => widget.event;

  @override
  void initState() {
    super.initState();
    _going = e.going;
    repo.rsvpCount(e.id).then((n) {
      if (mounted && n != null) setState(() => _headcount = n);
    });
    // Per-day schedule (FEATURE_BATCH_2 §C) — sessions from event_sessions.
    final id = e.id;
    if (id != null) {
      repo.loadEventSessions(id).then((s) {
        if (mounted) setState(() => _sessions = s);
      }).catchError((_) {/* offline — the summary card still shows */});
    }
  }

  Future<void> _setGoing(bool going) async {
    setState(() {
      if (_going == true && !going) _headcount--;
      if (_going != true && going) _headcount++;
      _going = going;
    });
    final err = await repo.setRsvp(e.id, going);
    if (err != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Blue header
          Container(
            decoration: const BoxDecoration(
              color: T.accent,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: SafeArea(
              bottom: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.of(context).maybePop(),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.arrow_back, size: 16, color: Colors.white),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(.22),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                            e.required ? 'Required event' : 'Optional · RSVP open',
                            style: T.ui(10, weight: FontWeight.w800, color: Colors.white)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(e.name, style: T.display(24, color: Colors.white)),
                  const SizedBox(height: 3),
                  Text(e.dateLine, style: T.ui(12, color: Colors.white.withOpacity(.92))),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
              children: [
                CampusCard(
                  radius: 18,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Column(
                    children: [
                      _infoRow(T.student, T.studentDeep, Icons.play_arrow_rounded,
                          e.windowLine ?? e.dateLine,
                          'Scans outside the window need approval'),
                      const SizedBox(height: 11),
                      _infoRow(T.checker, T.checkerDeep, Icons.place_rounded,
                          e.venue.isEmpty ? 'Venue to be announced' : e.venue,
                          'Scan your QR at the entrance gate'),
                      if (e.closeLabel != null) ...[
                        const SizedBox(height: 11),
                        _infoRow(T.alert, T.alertDeep, Icons.priority_high_rounded,
                            'Late scans go to review',
                            'After ${e.closeLabel} your entry needs approval',
                            tintAlpha: .12),
                      ],
                    ],
                  ),
                ),
                if (_sessions.isNotEmpty) ...[
                  const SizedBox(height: 11),
                  CampusCard(
                    radius: 18,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionLabel('Schedule'),
                        const SizedBox(height: 4),
                        ..._scheduleRows(),
                      ],
                    ),
                  ),
                ],
                if (!e.required) ...[
                  const SizedBox(height: 11),
                  CampusCard(
                    radius: 18,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Are you going?', style: T.display(14)),
                              const SizedBox(height: 2),
                              Text('$_headcount going · helps the SG plan food & seats',
                                  style: T.ui(10.5, color: T.text2)),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: () => _setGoing(true),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: _going == true ? T.checker : Colors.transparent,
                              border: _going == true
                                  ? null
                                  : Border.all(color: const Color(0xFFD5DCD8), width: 1.5),
                              borderRadius: BorderRadius.circular(99),
                              boxShadow: _going == true
                                  ? [BoxShadow(color: T.checker.withOpacity(.3), blurRadius: 14, offset: const Offset(0, 5))]
                                  : null,
                            ),
                            child: Text('Going ✓',
                                style: T.ui(11.5, weight: FontWeight.w800,
                                    color: _going == true ? Colors.white : T.text2)),
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => _setGoing(false),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: _going == false ? T.danger : Colors.transparent,
                              border: _going == false
                                  ? null
                                  : Border.all(color: const Color(0xFFD5DCD8), width: 1.5),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text('Can’t',
                                style: T.ui(11.5, weight: FontWeight.w700,
                                    color: _going == false ? Colors.white : T.text2)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 11),
                CampusCard(
                  radius: 18,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionLabel('Your QR'),
                      const SizedBox(height: 5),
                      Text(
                        'Your QR is cached on this phone — it works even with no signal at the venue.',
                        style: T.ui(11.5, color: T.text2, height: 1.55),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: SafeArea(
              top: false,
              child: PillButton('Open my ID', onTap: () {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(
                      builder: (_) => const HomeShell(initialIndex: HomeShell.tabId)),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }

  /// Sessions grouped day by day: a date header whenever the day changes,
  /// then each session's program, venue, mode and checking window.
  List<Widget> _scheduleRows() {
    final rows = <Widget>[];
    String? day;
    final multiDay = _sessions.map((s) => s.dayLabel).toSet().length > 1;
    for (final s in _sessions) {
      if (multiDay && s.dayLabel != day) {
        day = s.dayLabel;
        rows.add(Padding(
          padding: const EdgeInsets.only(top: 9, bottom: 2),
          child: Text(s.dayLabel.toUpperCase(),
              style: T.sectionLabel(color: T.accentDeep, size: 10)),
        ));
      }
      rows.add(Padding(
        padding: const EdgeInsets.only(top: 7),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: T.tint(T.student),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(s.inOnly ? Icons.login_rounded : Icons.sync_alt_rounded,
                  size: 17, color: T.studentDeep),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.program.isEmpty ? 'Attendance check' : s.program,
                      style: T.ui(12.5, weight: FontWeight.w700)),
                  Text(
                    [
                      if (s.venue.isNotEmpty) s.venue,
                      s.windowLine,
                      s.inOnly ? 'check-in only' : 'check-in & out',
                    ].join(' · '),
                    style: T.ui(10.5, color: T.text2),
                  ),
                ],
              ),
            ),
          ],
        ),
      ));
    }
    return rows;
  }

  Widget _infoRow(Color tint, Color deep, IconData icon, String title, String sub,
          {double tintAlpha = .1}) =>
      Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: T.tint(tint, tintAlpha),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 17, color: deep),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: T.ui(12.5, weight: FontWeight.w700)),
                Text(sub, style: T.ui(10.5, color: T.text2)),
              ],
            ),
          ),
        ],
      );
}
