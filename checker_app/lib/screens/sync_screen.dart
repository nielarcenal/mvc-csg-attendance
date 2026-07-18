import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/scan_store.dart';

/// 5a — Sync status: upload progress, "safe to retry" note, per-scan rows
/// (uploading / queued / merged / synced), Sync now. The rows are the real
/// offline queue of the active scan session; without a session the queue
/// view is empty.
class SyncScreen extends StatefulWidget {
  const SyncScreen({super.key, this.session});

  final ScanSession? session;

  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncItem {
  _SyncItem(this.name, this.line, this.state);
  final String name;
  final String line;
  SyncState state;
}

class _SyncScreenState extends State<SyncScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 1),
  )..repeat(reverse: true);

  int _done = 0;
  int _total = 0;

  ScanSession? get s => widget.session;

  @override
  void initState() {
    super.initState();
    final session = s;
    if (session != null) {
      _total = session.queue.length;
      _done = 0;
      session.addListener(_onSession);
    }
  }

  void _onSession() {
    if (!mounted) return;
    setState(() {
      final remaining = s!.queue
          .where((q) => q.state == SyncState.queued || q.state == SyncState.uploading)
          .length;
      _done = (_total - remaining).clamp(0, _total);
    });
  }

  List<_SyncItem> get _items {
    final session = s;
    if (session == null) return const [];
    String nameOf(String studentId) =>
        roster.where((r) => r.id == studentId).firstOrNull?.name ?? 'Student';
    String clock(String iso) {
      final d = DateTime.parse(iso).toLocal();
      final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
      return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
    }

    return session.queue
        .map((q) => _SyncItem(
              nameOf(q.studentId),
              '${q.scanType} ${clock(q.scannedAt)} · ${q.method.toUpperCase()} · ${q.school}',
              q.state,
            ))
        .toList();
  }

  @override
  void dispose() {
    s?.removeListener(_onSession);
    _pulse.dispose();
    super.dispose();
  }

  bool _syncing = false;

  Future<void> _syncNow() async {
    if (_syncing) return;
    setState(() => _syncing = true);
    await s?.flush();
    if (mounted) setState(() => _syncing = false);
  }

  @override
  Widget build(BuildContext context) {
    final online = s?.online ?? true;
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
                  Expanded(child: Text('Sync status', style: T.display(20))),
                  if (online)
                    StatusChip.green('● ONLINE')
                  else
                    StatusChip.orange('● OFFLINE'),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
                children: [
                  // Progress card
                  CampusCard(
                    radius: 18,
                    padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 15),
                    shadows: T.emphasisShadow,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Uploading queue', style: T.display(15)),
                            Text('$_done of $_total',
                                style: T.ui(11, weight: FontWeight.w800, color: T.studentDeep)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(5),
                          child: LinearProgressIndicator(
                            value: _total == 0 ? 1.0 : _done / _total,
                            minHeight: 8,
                            backgroundColor: T.hairline2,
                            valueColor: const AlwaysStoppedAnimation(T.student),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Client-generated IDs · idempotent',
                                style: T.ui(10, weight: FontWeight.w600, color: T.text2)),
                            Text('${_items.length} in queue',
                                style: T.ui(10, weight: FontWeight.w600, color: T.text2)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    decoration: BoxDecoration(
                      color: T.tint(T.checker, .08),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: 'Safe to retry. ',
                              style: T.ui(11, weight: FontWeight.w800, color: T.checkerDeep)),
                          const TextSpan(
                              text:
                                  'Every scan carries its own ID — re-uploads can’t create duplicates, and the scan '),
                          TextSpan(text: 'time',
                              style: T.ui(11, weight: FontWeight.w800, color: T.checkerDeep)),
                          const TextSpan(text: ' (not upload time) decides validity.'),
                        ],
                      ),
                      style: T.ui(11, color: T.checkerDeep, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 10),
                  for (final item in _items) ...[
                    _row(item),
                    const SizedBox(height: 8),
                  ],
                  if (_items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 20),
                      child: Center(
                        child: Text(
                            s == null
                                ? 'No active scan session — open this from the scan screen to watch its queue.'
                                : 'Queue is clear — every scan is on the server.',
                            textAlign: TextAlign.center,
                            style: T.ui(11.5, color: T.muted)),
                      ),
                    ),
                ],
              ),
            ),
            if (s != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 10),
                child: PillButton(_syncing ? 'Syncing…' : 'Sync now',
                    busy: _syncing, onTap: _syncNow, fontSize: 13),
              ),
          ],
        ),
      ),
    );
  }

  Widget _row(_SyncItem item) {
    final (dotColor, label, labelColor) = switch (item.state) {
      SyncState.uploading => (T.student, 'Uploading…', T.studentDeep),
      SyncState.queued => (const Color(0xFFCFD6D2), 'Queued', T.muted),
      SyncState.merged => (T.alert, 'Merged · earliest kept', T.alertDeep),
      SyncState.synced => (T.checker, 'Synced ✓', T.checkerDeep),
    };
    Widget dot = Container(
      width: 9,
      height: 9,
      decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
    );
    if (item.state == SyncState.uploading) {
      dot = FadeTransition(opacity: Tween(begin: 1.0, end: .3).animate(_pulse), child: dot);
    }
    return CampusCard(
      radius: 14,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: Row(
        children: [
          dot,
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: T.ui(12.5, weight: FontWeight.w700)),
                Text(item.line, style: T.ui(10, color: T.text2)),
              ],
            ),
          ),
          Text(label, style: T.ui(10, weight: FontWeight.w800, color: labelColor)),
        ],
      ),
    );
  }
}
