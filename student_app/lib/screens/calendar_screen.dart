import 'package:flutter/material.dart';
import '../data/live_repo.dart' as repo;
import '../data/models.dart';
import '../theme.dart';
import 'event_detail_screen.dart';

/// 6a — Calendar: real month grid with event dots (green = attended,
/// blue = upcoming, red = absent; today = filled blue circle) + event rows.
/// Navigable across months; data comes from [calendarEvents].
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  bool _monthView = true;
  late DateTime _month; // first day of the visible month

  static const _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];


  Future<void> _refresh() async {
    try { await repo.refreshAll(); } catch (_) {/* keep last loaded data */}
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  Color _dotColor(CalStatus s) => switch (s) {
        CalStatus.attended => T.checker,
        CalStatus.excused => T.student,
        CalStatus.absent => T.danger,
        CalStatus.upcoming => T.student,
        CalStatus.optionalPast => T.muted,
      };

  Widget _chip(CalStatus s) => switch (s) {
        CalStatus.attended => StatusChip.green('Present ✓'),
        CalStatus.excused => StatusChip.blue('Excused'),
        CalStatus.absent => StatusChip.red('Absent'),
        CalStatus.upcoming => const OutlineChip('Upcoming'),
        CalStatus.optionalPast => const OutlineChip('Optional'),
      };

  List<CalendarEvent> get _monthEvents => calendarEvents
      .where((e) => e.date.year == _month.year && e.date.month == _month.month)
      .toList()
    ..sort((a, b) => a.date.compareTo(b.date));

  void _openEvent(CalendarEvent e) {
    if (e.status != CalStatus.upcoming) return;
    final item = upcomingEvents.where((u) => u.id != null && u.id == e.id).firstOrNull;
    if (item == null) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => EventDetailScreen(event: item),
    ));
  }

  @override
  Widget build(BuildContext context) {
    // List view shows everything, newest month first; month view shows
    // the visible month only.
    final listEvents = _monthView
        ? _monthEvents
        : (List<CalendarEvent>.from(calendarEvents)
          ..sort((a, b) => b.date.compareTo(a.date)));

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Calendar', style: T.display(24)),
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: T.surface,
                    borderRadius: BorderRadius.circular(99),
                    boxShadow: [
                      BoxShadow(color: T.ink.withOpacity(.05), blurRadius: 8, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Row(
                    children: [
                      _segment('Month', _monthView, () => setState(() => _monthView = true)),
                      _segment('List', !_monthView, () => setState(() => _monthView = false)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: T.accent,
              onRefresh: _refresh,
              child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              children: [
                if (_monthView) ...[
                  CampusCard(
                    radius: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            GestureDetector(
                              onTap: () => setState(
                                  () => _month = DateTime(_month.year, _month.month - 1)),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                child: Text('‹', style: T.ui(15, weight: FontWeight.w700, color: T.text2)),
                              ),
                            ),
                            Text('${_monthNames[_month.month - 1]} ${_month.year}',
                                style: T.display(14)),
                            GestureDetector(
                              onTap: () => setState(
                                  () => _month = DateTime(_month.year, _month.month + 1)),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                child: Text('›', style: T.ui(15, weight: FontWeight.w700, color: T.text2)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 11),
                        Row(
                          children: [
                            for (final d in ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])
                              Expanded(
                                child: Center(
                                  child: Text(d, style: T.sectionLabel(size: 9)),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ..._weeks(),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                for (final e in listEvents) ...[
                  Opacity(
                    opacity: e.status == CalStatus.absent ? .85 : 1,
                    child: _eventRow(e),
                  ),
                  const SizedBox(height: 9),
                ],
                if (listEvents.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 26),
                    child: Center(
                      child: Text('No events this month',
                          style: T.ui(11.5, color: T.muted)),
                    ),
                  ),
              ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _segment(String label, bool active, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 5),
          decoration: BoxDecoration(
            color: active ? T.darkCard : Colors.transparent,
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(label,
              style: T.ui(10.5,
                  weight: active ? FontWeight.w800 : FontWeight.w700,
                  color: active ? Colors.white : T.text2)),
        ),
      );

  List<Widget> _weeks() {
    final first = DateTime(_month.year, _month.month, 1);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final leadIn = first.weekday % 7; // Sunday-start grid
    final totalCells = ((leadIn + daysInMonth) + 6) ~/ 7 * 7;

    // Event dots for the visible month, keyed by day. When several events
    // land on the same day, the "worst" status wins (absent > upcoming > …).
    final dots = <int, Color>{};
    const rank = {
      CalStatus.absent: 0, CalStatus.attended: 1, CalStatus.excused: 2,
      CalStatus.upcoming: 3, CalStatus.optionalPast: 4,
    };
    final byDay = <int, CalendarEvent>{};
    for (final e in _monthEvents) {
      final cur = byDay[e.date.day];
      if (cur == null || rank[e.status]! < rank[cur.status]!) byDay[e.date.day] = e;
    }
    byDay.forEach((day, e) => dots[day] = _dotColor(e.status));

    final today = DateTime.now();
    final isThisMonth = today.year == _month.year && today.month == _month.month;

    return [
      for (var w = 0; w < totalCells ~/ 7; w++) ...[
        Row(
          children: [
            for (var d = 0; d < 7; d++)
              Expanded(
                child: _cell(w * 7 + d, leadIn, daysInMonth, dots,
                    isThisMonth ? today.day : null),
              ),
          ],
        ),
        const SizedBox(height: 6),
      ],
    ];
  }

  Widget _cell(int index, int leadIn, int daysInMonth, Map<int, Color> dots, int? today) {
    final dayNum = index - leadIn + 1;
    final outside = dayNum < 1 || dayNum > daysInMonth;
    final int label;
    if (dayNum < 1) {
      label = DateTime(_month.year, _month.month, 0).day + dayNum; // prev month
    } else if (dayNum > daysInMonth) {
      label = dayNum - daysInMonth; // next month
    } else {
      label = dayNum;
    }
    final dot = outside ? null : dots[dayNum];
    final isToday = !outside && dayNum == today;
    return SizedBox(
      height: 34,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (isToday)
            Container(
              width: 26,
              height: 26,
              decoration: const BoxDecoration(color: T.student, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: Text('$label', style: T.ui(11.5, weight: FontWeight.w800, color: Colors.white)),
            )
          else
            Text('$label',
                style: T.ui(11.5,
                    weight: FontWeight.w600,
                    color: outside ? const Color(0xFFD0D7D3) : T.ink)),
          if (dot != null)
            Positioned(
              bottom: 0,
              child: Container(
                width: 5,
                height: 5,
                decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
              ),
            ),
        ],
      ),
    );
  }

  Widget _eventRow(CalendarEvent e) => CampusCard(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
        onTap: e.status == CalStatus.upcoming ? () => _openEvent(e) : null,
        child: Row(
          children: [
            Container(
              width: 4,
              height: 38,
              decoration: BoxDecoration(
                  color: _dotColor(e.status), borderRadius: BorderRadius.circular(3)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.name, style: T.ui(13, weight: FontWeight.w700)),
                  const SizedBox(height: 1),
                  Text(e.line, style: T.ui(10.5, color: T.text2)),
                ],
              ),
            ),
            _chip(e.status),
          ],
        ),
      );
}
