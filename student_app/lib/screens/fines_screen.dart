import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/live_repo.dart' as repo;
import '../data/models.dart';
import 'excuse_screen.dart';

/// 6a — Fines tracker: dark balance card, Paid/Waived/Unpaid tiles,
/// history cards, auto-waive explainer.
class FinesScreen extends StatefulWidget {
  const FinesScreen({super.key});

  @override
  State<FinesScreen> createState() => _FinesScreenState();
}

class _FinesScreenState extends State<FinesScreen> {

  Future<void> _refresh() async {
    try { await repo.refreshAll(); } catch (_) {/* keep last loaded data */}
    if (mounted) setState(() {});
  }

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
              child: RefreshIndicator(
                color: T.accent,
                onRefresh: _refresh,
                child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
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
                        const SizedBox(height: 6),
                        Text('Fines are settled in person at the SG office.',
                            style: T.ui(10, color: Colors.white.withOpacity(.6))),
                        const SizedBox(height: 13),
                        if (unpaid > 0)
                          GestureDetector(
                            onTap: () => Navigator.of(context)
                                .push(MaterialPageRoute(builder: (_) => const ExcuseScreen())),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 9),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(99),
                              ),
                              alignment: Alignment.center,
                              child: Text('File an excuse',
                                  style: T.ui(11.5, weight: FontWeight.w800)),
                            ),
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
                  if (fineEntries.isEmpty)
                    CampusCard(
                      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 16),
                      child: Center(
                        child: Text('No fines on record — keep it up!',
                            style: T.ui(11.5, color: T.muted)),
                      ),
                    ),
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
