import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/demo_data.dart';
import 'excuse_screen.dart';

/// 2a — Attendance history: semester ring (92%), status chips, filter pills,
/// per-event cards (absent card links to the excuse form).
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  String _filter = 'All';

  @override
  Widget build(BuildContext context) {
    final entries = historyEntries.where((e) {
      switch (_filter) {
        case 'Present':
          return e.status == AttendanceStatus.present;
        case 'Excused':
          return e.status == AttendanceStatus.excused;
        case 'Absent':
          return e.status == AttendanceStatus.absent;
        default:
          return true;
      }
    }).toList();

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
              child: Row(
                children: [
                  const BackDot(),
                  const SizedBox(width: 12),
                  Text('My attendance', style: T.display(20)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
                children: [
                  CampusCard(
                    radius: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 74,
                          height: 74,
                          child: CustomPaint(
                            painter: _SemesterRing(.92),
                            child: Center(
                              child: Text('92%', style: T.display(17, color: T.checkerDeep)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('1st Semester, S.Y. 2026–27', style: T.ui(13, weight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text('23 of 25 required events attended', style: T.ui(11, color: T.text2)),
                              const SizedBox(height: 7),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  StatusChip.green('23 present', fontSize: 9.5),
                                  StatusChip.orange('1 excused', fontSize: 9.5),
                                  StatusChip.red('1 absent', fontSize: 9.5),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      for (final f in ['All', 'Present', 'Excused', 'Absent']) ...[
                        _filterPill(f),
                        const SizedBox(width: 7),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  for (final e in entries) ...[
                    _historyCard(e),
                    const SizedBox(height: 9),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterPill(String label) {
    final active = _filter == label;
    return GestureDetector(
      onTap: () => setState(() => _filter = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? T.darkCard : T.surface,
          borderRadius: BorderRadius.circular(99),
          boxShadow: active
              ? null
              : [BoxShadow(color: T.ink.withOpacity(.05), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Text(label,
            style: T.ui(11,
                weight: active ? FontWeight.w800 : FontWeight.w700,
                color: active ? Colors.white : T.text2)),
      ),
    );
  }

  Widget _historyCard(HistoryEntry e) {
    final chip = switch (e.status) {
      AttendanceStatus.present => StatusChip.green('Present'),
      AttendanceStatus.excused => StatusChip.orange('Excused ✓'),
      _ => StatusChip.red('Absent'),
    };
    return CampusCard(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(e.event, style: T.ui(13, weight: FontWeight.w700)),
              chip,
            ],
          ),
          const SizedBox(height: 3),
          Text(e.line, style: T.ui(10.5, color: T.text2)),
          if (e.fine != null) ...[
            const SizedBox(height: 9),
            Row(
              children: [
                StatusChip.red(e.fine!),
                const SizedBox(width: 8),
                OutlineChip('File an excuse →', onTap: () {
                  Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const ExcuseScreen()));
                }),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Conic-style ring: green arc for the attended fraction over a faint track.
class _SemesterRing extends CustomPainter {
  _SemesterRing(this.fraction);

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawOval(rect, Paint()..color = T.hairline2);
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * fraction, true, Paint()..color = T.checker);
    final inner = rect.deflate(9);
    canvas.drawOval(inner, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(_SemesterRing old) => old.fraction != fraction;
}
