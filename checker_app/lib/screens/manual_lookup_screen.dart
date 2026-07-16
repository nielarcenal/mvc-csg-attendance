import 'package:flutter/material.dart';
import '../data/live_repo.dart' as repo;
import '../theme.dart';
import '../data/scan_store.dart';

/// 2b — Manual lookup: search over the cached roster, amber "tagged and
/// reviewed" warning, result rows with scan state, expanded row records
/// a manual time-in.
class ManualLookupScreen extends StatefulWidget {
  const ManualLookupScreen({super.key, this.school = 'SOC', this.session});

  final String school;
  final ScanSession? session;

  @override
  State<ManualLookupScreen> createState() => _ManualLookupScreenState();
}

class _ManualLookupScreenState extends State<ManualLookupScreen> {
  final _query = TextEditingController(text: repo.hasBackend ? '' : 'dela');
  String? _expanded = repo.hasBackend ? null : 'Dela Cruz, Juan Miguel';
  final Map<String, String> _recorded =
      repo.hasBackend ? {} : {'Dela Cruz, Andrea B.': '7:38'};

  Future<void> _recordManual(RosterEntry r) async {
    final now = DateTime.now();
    final h = now.hour % 12 == 0 ? 12 : now.hour % 12;
    setState(() =>
        _recorded[r.name] = '$h:${now.minute.toString().padLeft(2, '0')}');
    if (widget.session != null && repo.hasBackend) {
      await widget.session!
          .recordStudent(r, method: 'manual', note: 'manual lookup');
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: T.darkCard,
      content: Text('Time-in recorded · manual · tagged for review',
          style: T.ui(12, color: Colors.white)),
    ));
  }

  static const _avatarColors = [T.checker, T.student, T.maker, T.alert];

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.text.trim().toLowerCase();
    final results = q.isEmpty
        ? <RosterEntry>[]
        : roster
            .where((r) =>
                r.name.toLowerCase().contains(q) || r.studentNo.contains(q))
            .toList();

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              child: Row(
                children: [
                  const BackDot(),
                  const SizedBox(width: 12),
                  Expanded(child: Text('Manual lookup', style: T.display(20))),
                  StatusChip.green(widget.school),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: T.surface,
                      border: Border.all(color: T.accent, width: 2),
                      borderRadius: BorderRadius.circular(99),
                      boxShadow: T.restShadow,
                    ),
                    child: TextField(
                      controller: _query,
                      onChanged: (_) => setState(() {}),
                      autofocus: true,
                      style: T.ui(13.5, weight: FontWeight.w700),
                      decoration: InputDecoration(
                        hintText: 'Search name or student number…',
                        hintStyle: T.ui(13, color: T.muted),
                        prefixIcon: const Icon(Icons.search, size: 18, color: T.muted),
                        border: InputBorder.none,
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
                    child: Row(
                      children: [
                        Text('⚑ ', style: T.ui(10, weight: FontWeight.w800, color: T.alertDeep)),
                        Expanded(
                          child: Text('Manual entries are tagged and reviewed by the event maker',
                              style: T.ui(10, weight: FontWeight.w600, color: T.alertDeep)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                children: [
                  for (final r in results) ...[
                    _resultCard(r),
                    const SizedBox(height: 8),
                  ],
                  if (q.isNotEmpty && results.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 24),
                      child: Center(
                        child: Text('No students match “$q” on the cached roster',
                            style: T.ui(11.5, color: T.muted)),
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

  Widget _resultCard(RosterEntry r) {
    final expanded = _expanded == r.name;
    final inTime = _recorded[r.name];
    final highlight = _query.text.trim().toLowerCase();

    return CampusCard(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
      shadows: expanded ? T.emphasisShadow : null,
      onTap: () => setState(() => _expanded = expanded ? null : r.name),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 19,
                backgroundColor: _avatarColors[r.colorSeed % _avatarColors.length],
                child: Text(r.initials,
                    style: T.ui(13, weight: FontWeight.w800, color: Colors.white)),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _highlightedName(r.name, highlight),
                    const SizedBox(height: 1),
                    Text('${r.studentNo} · ${r.course}', style: T.ui(10.5, color: T.text2)),
                  ],
                ),
              ),
              if (inTime != null)
                StatusChip.green('In · $inTime', fontSize: 9.5)
              else
                StatusChip.orange('No scan yet', fontSize: 9.5),
            ],
          ),
          if (expanded && inTime == null) ...[
            const SizedBox(height: 11),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => _recordManual(r),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: T.accent,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      alignment: Alignment.center,
                      child: Text('Record time-in · manual',
                          style: T.ui(12, weight: FontWeight.w800, color: Colors.white)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFD5DCD8), width: 1.5),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text('Details', style: T.ui(12, weight: FontWeight.w700, color: T.text2)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _highlightedName(String name, String query) {
    if (query.isEmpty) return Text(name, style: T.ui(13.5, weight: FontWeight.w700));
    final ix = name.toLowerCase().indexOf(query);
    if (ix < 0) return Text(name, style: T.ui(13.5, weight: FontWeight.w700));
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: name.substring(0, ix)),
        TextSpan(
            text: name.substring(ix, ix + query.length),
            style: const TextStyle(decoration: TextDecoration.underline)),
        TextSpan(text: name.substring(ix + query.length)),
      ]),
      style: T.ui(13.5, weight: FontWeight.w700),
    );
  }
}
