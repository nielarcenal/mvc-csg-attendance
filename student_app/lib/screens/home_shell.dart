import 'package:flutter/material.dart';
import '../theme.dart';
import 'home_screen.dart';
import 'digital_id_screen.dart';
import 'calendar_screen.dart';
import 'more_screen.dart';

/// Bottom navigation per UX §1: exactly Home · Calendar · My ID · Profile.
/// Everything else (fines, excuses, history, notifications) is reachable
/// from Home cards and from Profile — never as extra tabs.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  /// Tab indexes, so callers never hardcode positions.
  static const tabHome = 0, tabCalendar = 1, tabId = 2, tabProfile = 3;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = widget.initialIndex;

  void goTo(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          HomeScreen(
            onOpenId: () => goTo(HomeShell.tabId),
            onOpenCalendar: () => goTo(HomeShell.tabCalendar),
          ),
          const CalendarScreen(),
          const DigitalIdScreen(),
          const MoreScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: T.surface,
          indicatorColor: T.tint(T.accent, .14),
          height: 64,
          labelTextStyle: WidgetStateProperty.resolveWith(
            (states) => T.ui(10,
                weight: states.contains(WidgetState.selected)
                    ? FontWeight.w700
                    : FontWeight.w600,
                color: states.contains(WidgetState.selected) ? T.accentDeep : T.muted),
          ),
        ),
        child: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: goTo,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_rounded), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.calendar_month_rounded), label: 'Calendar'),
            NavigationDestination(icon: Icon(Icons.qr_code_2_rounded), label: 'My ID'),
            NavigationDestination(icon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
