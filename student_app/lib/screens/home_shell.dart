import 'package:flutter/material.dart';
import '../theme.dart';
import 'home_screen.dart';
import 'digital_id_screen.dart';
import 'calendar_screen.dart';
import 'more_screen.dart';

/// 4-tab bottom bar: Home · ID · Calendar · More.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = widget.initialIndex;

  static const _tabs = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.qr_code_2_rounded, label: 'ID'),
    (icon: Icons.calendar_month_rounded, label: 'Calendar'),
    (icon: Icons.more_horiz_rounded, label: 'More'),
  ];

  void goTo(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          HomeScreen(onOpenId: () => goTo(1), onOpenCalendar: () => goTo(2)),
          const DigitalIdScreen(),
          const CalendarScreen(),
          const MoreScreen(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: T.surface,
          border: Border(top: BorderSide(color: T.hairline)),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 10, 8, 6),
            child: Row(
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => goTo(i),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_tabs[i].icon,
                              size: 22, color: i == _index ? T.accent : T.muted),
                          const SizedBox(height: 3),
                          Text(
                            _tabs[i].label,
                            style: T.ui(9.5,
                                weight: i == _index ? FontWeight.w700 : FontWeight.w600,
                                color: i == _index ? T.accentDeep : T.muted),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
