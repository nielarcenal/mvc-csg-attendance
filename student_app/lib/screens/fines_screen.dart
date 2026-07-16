import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/demo_data.dart';
import 'excuse_screen.dart';

/// 6a — Fines tracker: dark balance card, Paid/Waived/Unpaid tiles,
/// history cards, auto-waive explainer.
class FinesScreen extends StatelessWidget {
  const FinesScreen({super.key});

  double _sum(String tone) => fineEntries
      .where((f) => f.tone == tone)
      .fold(0.0, (sum, f) => sum + f.amount);

  @override
  Widget build(BuildContext context) {
    final unpaid = _sum('red');
    final unpaidCount = fineEntries.where((f) => f.tone == 'red').length;
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
                  Text('My fines', style: T.display(20)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
                children: [
                  // Dark balance card
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: T.darkCard,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(color: T.ink.withOpacity(.25), blurRadius: 24, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('OUTSTANDING BALANCE',
                            style: T.sectionLabel(color: Colors.white.withOpacity(.6), size: 10)),
                        const SizedBox(height: 4),
                        Text('₱${unpaid.toStringAsFixed(2)}',
                            style: T.display(34,
                                color: unpaid > 0 ? const Color(0xFFFF9D94) : const Color(0xFF9FE0B5))),
                        const SizedBox(height: 2),
                        Text(
                            unpaidCount == 0
                                ? 'All clear · S.Y. 2026–27'
                                : '$unpaidCount unexcused absence${unpaidCount == 1 ? '' : 's'} · S.Y. 2026–27',
                            style: T.ui(11, color: Colors.white.withOpacity(.75))),
                        const SizedBox(height: 13),
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                alignment: Alignment.center,
                                child: Text('Pay at SG office',
                                    style: T.ui(11.5, weight: FontWeight.w800)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () => Navigator.of(context)
                                  .push(MaterialPageRoute(builder: (_) => const ExcuseScreen())),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.white.withOpacity(.4), width: 1.5),
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text('File excuse',
                                    style: T.ui(11.5, weight: FontWeight.w700, color: Colors.white)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 11),
                  Row(
                    children: [
                      _summaryTile('PAID', '₱${_sum('green').toStringAsFixed(0)}', T.checkerDeep),
                      const SizedBox(width: 8),
                      _summaryTile('WAIVED', '₱${_sum('blue').toStringAsFixed(0)}', T.studentDeep),
                      const SizedBox(width: 8),
                      _summaryTile('UNPAID', '₱${unpaid.toStringAsFixed(0)}', T.dangerDeep),
                    ],
                  ),
                  const SizedBox(height: 11),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Text('HISTORY', style: T.sectionLabel(size: 10)),
                  ),
                  const SizedBox(height: 8),
                  for (final f in fineEntries) ...[
                    CampusCard(
                      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(f.event, style: T.ui(13, weight: FontWeight.w700)),
                              switch (f.tone) {
                                'red' => StatusChip.red(f.chip),
                                'blue' => StatusChip.blue(f.chip),
                                _ => StatusChip.green(f.chip),
                              },
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(f.line, style: T.ui(10.5, color: T.text2)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'Fines are auto-computed when an event closes. Approved excuses waive them automatically.',
                      textAlign: TextAlign.center,
                      style: T.ui(10, color: T.muted, height: 1.5),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryTile(String label, String value, Color color) => Expanded(
        child: CampusCard(
          radius: 14,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(
            children: [
              Text(label, style: T.sectionLabel(size: 8.5)),
              const SizedBox(height: 2),
              Text(value, style: T.display(15, color: color)),
            ],
          ),
        ),
      );
}
