import 'package:flutter/material.dart';
import '../theme.dart';
import '../data/live_repo.dart' as repo;
import '../data/models.dart';
import 'excuse_screen.dart';

/// 4c — Notifications: Today/Earlier groups; attendance recorded (green ✓),
/// reminder (blue ▸), marked absent (red !, with excuse chip),
/// announcement (purple ◎); unread = blue dot, read = 75% opacity.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {

  Future<void> _refresh() async {
    try { await repo.refreshAll(); } catch (_) {/* keep last loaded data */}
    if (mounted) setState(() {});
  }

  void _markAllRead() {
    setState(() {
      notifications = notifications.map((n) => n.asRead()).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final today = notifications.where((n) => n.today).toList();
    final earlier = notifications.where((n) => !n.today).toList();
    final hasUnread = notifications.any((n) => n.unread);

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
                  Expanded(child: Text('Notifications', style: T.display(20))),
                  if (hasUnread)
                    GestureDetector(
                      onTap: _markAllRead,
                      child: Text('Mark all read',
                          style: T.ui(11, weight: FontWeight.w700, color: T.accentDeep)),
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
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
                children: [
                  if (notifications.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 30),
                      child: Center(
                        child: Text('Nothing here yet — updates about your attendance appear here.',
                            textAlign: TextAlign.center,
                            style: T.ui(11.5, color: T.muted)),
                      ),
                    ),
                  if (today.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(2, 4, 0, 9),
                      child: Text('TODAY', style: T.sectionLabel(size: 10)),
                    ),
                    for (final n in today) ...[_tile(context, n), const SizedBox(height: 9)],
                  ],
                  if (earlier.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(2, 6, 0, 9),
                      child: Text('EARLIER', style: T.sectionLabel(size: 10)),
                    ),
                    for (final n in earlier) ...[_tile(context, n), const SizedBox(height: 9)],
                  ],
                ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(BuildContext context, NotificationItem n) {
    final (bg, fg, glyph) = switch (n.kind) {
      NotificationKind.recorded => (T.tint(T.checker), T.checkerDeep, '✓'),
      NotificationKind.reminder => (T.tint(T.student), T.studentDeep, '▸'),
      NotificationKind.absent => (T.tint(T.danger), T.dangerDeep, '!'),
      NotificationKind.announcement => (T.tint(T.maker), T.makerDeep, '◎'),
    };
    final card = CampusCard(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
            alignment: Alignment.center,
            child: Text(glyph, style: T.ui(16, weight: FontWeight.w800, color: fg)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(n.title,
                        style: T.ui(12.5, weight: n.unread ? FontWeight.w800 : FontWeight.w700)),
                    Text(n.time, style: T.ui(9.5, weight: FontWeight.w600, color: T.muted)),
                  ],
                ),
                const SizedBox(height: 2),
                Text(n.body, style: T.ui(11, color: T.text2, height: 1.45)),
                if (n.action != null) ...[
                  const SizedBox(height: 8),
                  OutlineChip(n.action!, onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ExcuseScreen()));
                  }),
                ],
              ],
            ),
          ),
          if (n.unread) ...[
            const SizedBox(width: 8),
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 4),
              decoration: const BoxDecoration(color: T.student, shape: BoxShape.circle),
            ),
          ],
        ],
      ),
    );
    return n.unread || n.action != null ? card : Opacity(opacity: .75, child: card);
  }
}
