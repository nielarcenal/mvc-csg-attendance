import 'package:flutter/material.dart';
import '../data/live_repo.dart' as repo;
import '../theme.dart';
import '../data/models.dart';
import 'change_password_screen.dart';
import 'history_screen.dart';
import 'fines_screen.dart';
import 'notifications_screen.dart';
import 'excuse_screen.dart';
import 'login_screen.dart';

/// Profile tab (UX §1) — identity card plus links to Attendance history,
/// Fines, Notifications and the Excuse form; Sign out at the bottom.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  Future<void> _confirmSignOut(BuildContext context) async {
    final ok = await confirmDialog(
      context,
      title: 'Sign out?',
      body: "You'll need your password to sign back in.",
      confirmLabel: 'Sign out',
    );
    if (!ok || !context.mounted) return;
    await repo.signOut();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
            child: Text('Profile', style: T.display(24)),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
              children: [
                CampusCard(
                  radius: 20,
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: T.accent, width: 2.5),
                        ),
                        child: CircleAvatar(
                          backgroundColor: T.hairline2,
                          child: Text(currentStudent.initials,
                              style: T.ui(12, weight: FontWeight.w800, color: T.muted)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(currentStudent.fullName, style: T.display(15)),
                          const SizedBox(height: 2),
                          Text('${currentStudent.studentNo} · ${currentStudent.course}',
                              style: T.ui(11, color: T.text2)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _item(context, Icons.fact_check_rounded, T.checker, T.checkerDeep,
                    'My attendance', 'History & semester stats', const HistoryScreen()),
                const SizedBox(height: 9),
                _item(context, Icons.payments_rounded, T.danger, T.dangerDeep, 'My fines',
                    _finesSub(), const FinesScreen()),
                const SizedBox(height: 9),
                _item(context, Icons.notifications_rounded, T.student, T.studentDeep,
                    'Notifications', _notifSub(), const NotificationsScreen()),
                const SizedBox(height: 9),
                _item(context, Icons.edit_document, T.alert, T.alertDeep, 'File an excuse',
                    'For a missed event', const ExcuseScreen()),
                const SizedBox(height: 9),
                _item(context, Icons.lock_rounded, T.accent, T.accentDeep,
                    'Change password', 'Takes effect on your next sign-in',
                    const ChangePasswordScreen()),
                const SizedBox(height: 18),
                GhostButton('Sign out', onTap: () => _confirmSignOut(context)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _finesSub() {
    final unpaid = fineEntries
        .where((f) => f.tone == 'red')
        .fold(0.0, (sum, f) => sum + f.amount);
    return unpaid > 0 ? '₱${unpaid.toStringAsFixed(0)} outstanding' : 'All clear';
  }

  String _notifSub() {
    final unread = notifications.where((n) => n.unread).length;
    return unread > 0 ? '$unread unread' : 'Nothing new';
  }

  Widget _item(BuildContext context, IconData icon, Color tint, Color deep, String title,
          String sub, Widget screen) =>
      CampusCard(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen)),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: T.tint(tint),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 19, color: deep),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: T.ui(13, weight: FontWeight.w700)),
                  const SizedBox(height: 1),
                  Text(sub, style: T.ui(10.5, color: T.text2)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: T.muted, size: 20),
          ],
        ),
      );
}
