import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/models.dart';
import '../data/live_repo.dart' as repo;
import 'event_detail_screen.dart';

/// 2a — Home: date + greeting, blue hero card for the next required event,
/// Upcoming list, Announcements. Pull-to-refresh refetches everything;
/// a failed refresh surfaces an error banner with Retry (UX §5).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onOpenId, required this.onOpenCalendar});

  final VoidCallback onOpenId;
  final VoidCallback onOpenCalendar;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _refreshFailed = false;

  VoidCallback get onOpenId => widget.onOpenId;
  VoidCallback get onOpenCalendar => widget.onOpenCalendar;

  // Repaint when the shell's silent auto-refresh lands new data (§C).
  @override
  void initState() {
    super.initState();
    repo.dataVersion.addListener(_onData);
  }

  void _onData() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    repo.dataVersion.removeListener(_onData);
    super.dispose();
  }

  static const _weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  String get _today {
    final now = DateTime.now();
    return '${_weekdays[now.weekday - 1]}, ${_months[now.month - 1]} ${now.day}';
  }

  Future<void> _refresh() async {
    try {
      await repo.refreshAll();
      if (mounted) setState(() => _refreshFailed = false);
    } catch (_) {
      if (mounted) setState(() => _refreshFailed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_today, style: T.ui(11.5, weight: FontWeight.w600, color: T.text2)),
                    const SizedBox(height: 1),
                    Text('Hi, ${currentStudent.firstName}', style: T.display(24)),
                  ],
                ),
                ClipOval(child: Image.asset('assets/sg-logo.png', width: 30, height: 30)),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: T.accent,
              onRefresh: _refresh,
              child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
              children: [
                if (_refreshFailed) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    decoration: BoxDecoration(
                      color: T.tint(T.danger, .1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text('Could not refresh — showing the last loaded data.',
                              style: T.ui(11, weight: FontWeight.w600, color: T.dangerDeep)),
                        ),
                        OutlineChip('Retry', color: T.danger, textColor: T.dangerDeep,
                            onTap: _refresh),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                // Hero card — next required event
                if (heroEvent != null)
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: T.accent,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(color: T.accent.withOpacity(.3), blurRadius: 24, offset: const Offset(0, 8)),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(heroEvent!.label,
                              style: T.sectionLabel(color: Colors.white.withOpacity(.85), size: 10)),
                          if (heroEvent!.isRequired)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(.22),
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text('Required', style: T.ui(10, weight: FontWeight.w800, color: Colors.white)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(heroEvent!.name, style: T.display(20, color: Colors.white)),
                      const SizedBox(height: 2),
                      Text(heroEvent!.line,
                          style: T.ui(12, color: Colors.white.withOpacity(.92))),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: onOpenId,
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                alignment: Alignment.center,
                                child: Text('Open my ID',
                                    style: T.ui(12, weight: FontWeight.w800, color: T.accentDeep)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () {
                              final item = upcomingEvents
                                  .where((e) => e.id != null && e.id == heroEvent?.id)
                                  .firstOrNull;
                              if (item == null) return;
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => EventDetailScreen(event: item)),
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.white.withOpacity(.5), width: 1.5),
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text('Details', style: T.ui(12, weight: FontWeight.w700, color: Colors.white)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // Upcoming
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Upcoming', style: T.display(15)),
                    GestureDetector(
                      onTap: onOpenCalendar,
                      child: Text('Calendar →', style: T.ui(11, weight: FontWeight.w700, color: T.accentDeep)),
                    ),
                  ],
                ),
                const SizedBox(height: 9),
                if (upcomingEvents.isEmpty)
                  CampusCard(
                    padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 16),
                    child: Center(
                      child: Text('No upcoming events yet',
                          style: T.ui(11.5, color: T.muted)),
                    ),
                  ),
                for (final e in upcomingEvents) ...[
                  CampusCard(
                    padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => EventDetailScreen(event: e)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          decoration: BoxDecoration(
                            color: T.tint(e.rsvpOpen ? T.student : T.maker, .1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            children: [
                              Text(e.monthTile!,
                                  style: T.ui(9, weight: FontWeight.w800,
                                      color: e.rsvpOpen ? T.studentDeep : T.makerDeep)),
                              Text(e.dayTile!,
                                  style: T.display(16, color: e.rsvpOpen ? T.studentDeep : T.makerDeep)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(e.name, style: T.ui(13, weight: FontWeight.w700)),
                              const SizedBox(height: 1),
                              Text(e.dateLine, style: T.ui(10.5, color: T.text2)),
                            ],
                          ),
                        ),
                        if (e.going == true)
                          StatusChip.green('Going ✓', fontSize: 10.5)
                        else
                          const OutlineChip('RSVP', fontSize: 10.5),
                      ],
                    ),
                  ),
                  const SizedBox(height: 9),
                ],
                if (announcements.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  // Announcements
                  Text('Announcements', style: T.display(15)),
                  const SizedBox(height: 9),
                  CampusCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (var i = 0; i < announcements.length; i++)
                          _announcement(announcements[i].title, announcements[i].body,
                              divider: i < announcements.length - 1),
                      ],
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

  Widget _announcement(String title, String body, {bool divider = false}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
        decoration: divider
            ? const BoxDecoration(border: Border(bottom: BorderSide(color: T.hairline2)))
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: T.ui(12.5, weight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(body, style: T.ui(10.5, color: T.text2)),
          ],
        ),
      );
}
