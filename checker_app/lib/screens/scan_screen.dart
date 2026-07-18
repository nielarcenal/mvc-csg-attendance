import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../theme.dart';
import '../data/scan_store.dart';
import '../widgets/viewfinder.dart';
import 'manual_lookup_screen.dart';
import 'kiosk_screen.dart';
import 'sync_screen.dart';

/// 1b + 3a — Scan screen: green header (school, ONLINE/OFFLINE pill,
/// Time-in/Time-out toggle), camera viewfinder, feedback card
/// (idle / success / duplicate / unknown), counters, manual lookup, RFID.
/// If the platform has no camera/decoder, manual lookup and the RFID
/// keyboard wedge remain the input paths.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key, required this.session, this.school = 'SOC'});

  final ScanSession session;
  final String school;

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> with WidgetsBindingObserver {
  ScanSession get s => widget.session;

  // If the platform has no camera / barcode support (e.g. desktop browsers
  // without the BarcodeDetector API), the static viewfinder renders and
  // manual lookup + RFID stay available.
  bool _cameraFailed = false;
  bool get _useCamera => !_cameraFailed;
  String? _lastToken;
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);

  // RFID readers act as keyboards: digits arrive as keystrokes ending
  // with Enter (keyboard-wedge input, spec §2 checker app).
  final _wedgeFocus = FocusNode();
  final _wedgeBuffer = StringBuffer();

  void _onWedgeKey(KeyEvent event) {
    if (event is! KeyDownEvent) return;
    if (event.logicalKey == LogicalKeyboardKey.enter) {
      final token = _wedgeBuffer.toString().trim();
      _wedgeBuffer.clear();
      if (token.isNotEmpty) {
        s.recordToken(token, method: 'rfid').then((_) => _haptics());
      }
      return;
    }
    final ch = event.character;
    if (ch != null && ch.length == 1 && ch.codeUnitAt(0) >= 32) {
      _wedgeBuffer.write(ch);
    }
  }

  void _cameraError() {
    if (_cameraFailed) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _cameraFailed = true);
    });
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    final value = capture.barcodes.firstOrNull?.rawValue;
    if (value == null) return;
    final now = DateTime.now();
    // Debounce: the camera re-reads the same code many times per second.
    if (value == _lastToken && now.difference(_lastAt).inSeconds < 3) return;
    _lastToken = value;
    _lastAt = now;
    await s.recordToken(value);
    _haptics();
  }

  // Distinct haptic + sound per outcome (UX §6). SystemSound only offers
  // click/alert, so the sounds are: accepted = click, duplicate = silence +
  // medium haptic, unknown = alert-or-click + heavy haptic. Fully distinct
  // custom audio assets are tracked in the known-gaps file.
  void _haptics() {
    switch (s.current?.result) {
      case ScanResult.success:
        HapticFeedback.lightImpact();
        SystemSound.play(SystemSoundType.click);
      case ScanResult.duplicate:
        HapticFeedback.mediumImpact();
      case ScanResult.unknown:
        HapticFeedback.heavyImpact();
        SystemSound.play(SystemSoundType.alert).catchError(
            (_) => SystemSound.play(SystemSoundType.click));
      case null:
        break;
    }
  }

  /// The hidden RFID wedge input must silently regain focus after every
  /// dialog, pushed screen, and app resume (UX §6).
  void _refocusWedge() {
    if (mounted) _wedgeFocus.requestFocus();
  }

  Future<void> _pushRefocusing(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    _refocusWedge();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refocusWedge();
  }

  static const _schoolNames = {
    'SBA': 'School of Business and Accountancy',
    'SOA': 'School of Agriculture',
    'SOC': 'School of Computing',
    'SAS': 'School of Arts and Sciences',
    'SOT': 'School of Theology',
    'SON': 'School of Nursing',
    'SMT': 'School of Medical Technology',
    'SOE': 'School of Education',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    s.addListener(_onSession);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    s.removeListener(_onSession);
    _wedgeFocus.dispose();
    super.dispose();
  }

  void _onSession() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final current = s.current;
    return Scaffold(
      body: KeyboardListener(
        focusNode: _wedgeFocus,
        autofocus: true,
        onKeyEvent: _onWedgeKey,
        child: Column(
        children: [
          // Green header
          Container(
            decoration: const BoxDecoration(
              color: T.accent,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(22),
                bottomRight: Radius.circular(22),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 18),
            child: SafeArea(
              bottom: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      IconButton(
                        tooltip: 'Back',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(Icons.arrow_back, size: 18, color: Colors.white),
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          '${widget.school} — ${_schoolNames[widget.school] ?? ''}',
                          style: T.display(17, color: Colors.white),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      NetPill(online: s.online, onTap: s.toggleOnline),
                    ],
                  ),
                  const SizedBox(height: 3),
                  // Persistent header: event, window, live counts (UX §1)
                  Text(
                      s.eventName != null
                          ? '${s.eventName} · ${s.windowLine ?? ''}'
                          : 'No event selected',
                      style: T.ui(11.5, color: Colors.white.withOpacity(.9))),
                  const SizedBox(height: 2),
                  Text('${s.scanned} scanned · ${s.queued} pending sync',
                      style: T.ui(10.5, weight: FontWeight.w700,
                          color: Colors.white.withOpacity(.85))),
                  const SizedBox(height: 10),
                  // Time-in / Time-out segmented toggle
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(.18),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _segment('Time-in', s.timeIn, () => s.setTimeIn(true)),
                        const SizedBox(width: 4),
                        _segment('Time-out', !s.timeIn, () => s.setTimeIn(false)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          // Viewfinder — real camera on mobile builds, simulated elsewhere
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: SizedBox(
              height: 200,
              width: double.infinity,
              child: _useCamera
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: MobileScanner(
                        onDetect: _onDetect,
                        errorBuilder: (context, error, child) {
                          _cameraError();
                          return const Viewfinder();
                        },
                      ),
                    )
                  : const Viewfinder(),
            ),
          ),
          const SizedBox(height: 12),
          // Feedback card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _FeedbackCard(record: current, timeIn: s.timeIn, school: widget.school),
          ),
          const SizedBox(height: 12),
          // Counters
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                _counter('SCANNED', '${s.scanned}', T.ink),
                const SizedBox(width: 10),
                _counter('QUEUED', '${s.queued}', s.online ? T.ink : T.alertDeep),
                const SizedBox(width: 10),
                _counter('DUPES', '${s.dupes}', T.ink),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Manual lookup + RFID
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => _pushRefocusing(
                        ManualLookupScreen(school: widget.school, session: s)),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: T.surface,
                        border: Border.all(color: const Color(0xFFD5DCD8), width: 1.5),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      alignment: Alignment.center,
                      child: Text('Manual lookup', style: T.ui(12.5, weight: FontWeight.w800)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text('● RFID ready', style: T.ui(10, weight: FontWeight.w700, color: T.checkerDeep)),
              ],
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 6),
            child: Row(
              children: [
                Expanded(
                  child: GhostButton('Kiosk mode', onTap: () {
                    _pushRefocusing(KioskScreen(session: s, school: widget.school));
                  }),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: GhostButton('Sync status', onTap: () {
                    _pushRefocusing(SyncScreen(session: s));
                  }),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: SizedBox(
                height: 14,
                child: s.online
                    ? null
                    : Text(
                        '${s.queued} scans queued — will sync automatically when back online',
                        textAlign: TextAlign.center,
                        style: T.ui(10, weight: FontWeight.w600, color: T.alertDeep),
                      ),
              ),
            ),
          ),
        ],
        ),
      ),
    );
  }

  Widget _segment(String label, bool active, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(label,
              style: T.ui(11,
                  weight: active ? FontWeight.w800 : FontWeight.w700,
                  color: active ? T.checkerDeep : Colors.white.withOpacity(.85))),
        ),
      );

  Widget _counter(String label, String value, Color color) => Expanded(
        child: CampusCard(
          radius: 14,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: T.sectionLabel(size: 9)),
              const SizedBox(height: 1),
              Text(value, style: T.display(20, color: color)),
            ],
          ),
        ),
      );
}

/// Feedback card — idle / success (green) / duplicate (orange) / unknown (red).
class _FeedbackCard extends StatelessWidget {
  const _FeedbackCard({required this.record, required this.timeIn, required this.school});

  final ScanRecord? record;
  final bool timeIn;
  final String school;

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final String glyph;
    final String label;
    final String name;
    final String meta;
    final String sub;
    final Color fg;

    if (record == null) {
      bg = T.hairline2;
      fg = T.ink;
      glyph = '▢';
      label = 'READY';
      name = 'Waiting for first scan';
      meta = 'Point the camera at a student QR';
      sub = 'RFID taps also register automatically';
    } else {
      fg = Colors.white;
      switch (record!.result) {
        case ScanResult.success:
          if (record!.forReview) {
            // Accepted late — clearly different BLUE state so checkers
            // don't panic (UX §6).
            bg = T.student;
            glyph = '✓';
            label = 'RECORDED — FOR REVIEW (${record!.lateMinutes} MIN LATE)';
            name = record!.name;
            meta = [if (record!.course?.isNotEmpty ?? false) record!.course, 'scanned ${record!.time}']
                .whereType<String>().join(' · ');
            sub = 'Accepted after the window — the event maker will review it';
            break;
          }
          bg = T.checker;
          glyph = '✓';
          label = timeIn ? 'TIME-IN RECORDED' : 'TIME-OUT RECORDED';
          name = record!.name;
          meta = [if (record!.course?.isNotEmpty ?? false) record!.course, 'scanned ${record!.time}']
              .whereType<String>().join(' · ');
          sub = '${record!.time} · ${record!.method} · $school';
        case ScanResult.duplicate:
          bg = T.alert;
          glyph = '⟳';
          label = timeIn ? 'ALREADY TIMED-IN' : 'ALREADY TIMED-OUT';
          name = record!.name;
          meta = 'Already recorded for this event · $school';
          sub = 'Blocked on-device against the cached roster';
        case ScanResult.unknown:
          bg = T.danger;
          glyph = '✕';
          label = 'NOT ON ROSTER';
          name = 'Unknown code';
          meta = 'This QR is not on the cached roster';
          sub = 'Retry, or use manual lookup';
      }
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(color: T.ink.withOpacity(.14), blurRadius: 24, offset: const Offset(0, 8)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: record == null ? Colors.white : Colors.white.withOpacity(.22),
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Text(glyph, style: T.ui(24, weight: FontWeight.w800, color: record == null ? T.muted : fg)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: T.sectionLabel(
                        color: record == null ? T.muted : fg.withOpacity(.85), size: 9.5)),
                const SizedBox(height: 2),
                Text(name, style: T.display(19, color: fg, height: 1.1),
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(meta,
                    style: T.ui(11.5, color: record == null ? T.text2 : fg.withOpacity(.92))),
                const SizedBox(height: 3),
                Text(sub,
                    style: T.ui(10, weight: FontWeight.w600,
                        color: record == null ? T.muted : fg.withOpacity(.8))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
