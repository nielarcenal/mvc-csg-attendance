import 'package:flutter/material.dart';
import '../theme.dart';
import 'event_detail_screen.dart';

/// 6a — Calendar: month grid with event dots (green = attended,
/// blue = upcoming, red = absent; today = filled blue circle) + event rows.
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  bool _monthView = true;

  // July 2026: Jul 1 is a Wednesday; grid starts Sun Jun 28.
  static const _dots = {8: T.danger, 15: T.checker, 24: T.student};
  static const _today = 15;

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
            child: ListView(
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
                            Text('‹', style: T.ui(13, weight: FontWeight.w700, color: T.muted)),
                            Text('July 2026', style: T.display(14)),
                            Text('›', style: T.ui(13, weight: FontWeight.w700, color: T.muted)),
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
                _eventRow('SG General Assembly', 'Today · 7:00 AM · MVC Gym', T.checker,
                    StatusChip.green('Present ✓')),
                const SizedBox(height: 9),
                _eventRow('Acquaintance Party', 'Fri Jul 24 · 6:00 PM · Covered Court', T.student,
                    const OutlineChip('RSVP'),
                    onTap: () => Navigator.of(context)
                        .push(MaterialPageRoute(builder: (_) => const EventDetailScreen()))),
                const SizedBox(height: 9),
                Opacity(
                  opacity: .8,
                  child: _eventRow('Community Cleanup', 'Jul 8 · 6:00 AM · Campus grounds', T.danger,
                      StatusChip.red('Absent')),
                ),
              ],
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
    // Jul 1, 2026 is a Wednesday: lead-in Jun 28–30, spill-over Aug 1.
    final cells = <(int, bool)>[
      for (var d = 28; d <= 30; d++) (d, true),
      for (var d = 1; d <= 31; d++) (d, false),
      (1, true),
    ];
    return [
      for (var w = 0; w < 5; w++) ...[
        Row(
          children: [
            for (var d = 0; d < 7; d++)
              Expanded(
                child: _dayCell(cells[w * 7 + d].$1, outside: cells[w * 7 + d].$2),
              ),
          ],
        ),
        const SizedBox(height: 6),
      ],
    ];
  }

  Widget _dayCell(int day, {bool outside = false}) {
    final dot = outside ? null : _dots[day];
    final isToday = !outside && day == _today;
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
              child: Text('$day', style: T.ui(11.5, weight: FontWeight.w800, color: Colors.white)),
            )
          else
            Text('$day',
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

  Widget _eventRow(String name, String line, Color bar, Widget chip, {VoidCallback? onTap}) =>
      CampusCard(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 4,
              height: 38,
              decoration: BoxDecoration(color: bar, borderRadius: BorderRadius.circular(3)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: T.ui(13, weight: FontWeight.w700)),
                  const SizedBox(height: 1),
                  Text(line, style: T.ui(10.5, color: T.text2)),
                ],
              ),
            ),
            chip,
          ],
        ),
      );
}
