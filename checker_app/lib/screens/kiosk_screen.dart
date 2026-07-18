import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../theme.dart';
import '../data/scan_store.dart';
import '../widgets/viewfinder.dart';

/// 5a — Kiosk mode: dark lock bar, full-height viewfinder, success card,
/// exit = hold the lock for 5 seconds.
class KioskScreen extends StatefulWidget {
  const KioskScreen({super.key, required this.session, this.school = 'SOC'});

  final ScanSession session;
  final String school;

  @override
  State<KioskScreen> createState() => _KioskScreenState();
}

class _KioskScreenState extends State<KioskScreen> {
  Timer? _holdTimer;
  bool _holding = false;
  bool _cameraFailed = false;
  String? _lastToken;
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);

  ScanSession get s => widget.session;

  bool get _useCamera => !_cameraFailed;

  Future<void> _onDetect(BarcodeCapture capture) async {
    final value = capture.barcodes.firstOrNull?.rawValue;
    if (value == null) return;
    final now = DateTime.now();
    if (value == _lastToken && now.difference(_lastAt).inSeconds < 3) return;
    _lastToken = value;
    _lastAt = now;
    await s.recordToken(value);
  }

  @override
  void initState() {
    super.initState();
    s.addListener(_onSession);
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    s.removeListener(_onSession);
    super.dispose();
  }

  void _onSession() => setState(() {});

  void _startHold() {
    setState(() => _holding = true);
    _holdTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) Navigator.of(context).maybePop();
    });
  }

  void _cancelHold() {
    _holdTimer?.cancel();
    setState(() => _holding = false);
  }

  @override
  Widget build(BuildContext context) {
    final current = s.current;
    final success = current != null && current.result == ScanResult.success;

    return Scaffold(
      body: Column(
        children: [
          // Dark lock bar
          Container(
            color: T.darkCard,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: SafeArea(
              bottom: false,
              child: Row(
                children: [
                  Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(.14),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.lock, size: 13, color: Colors.white),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Kiosk mode', style: T.ui(12.5, weight: FontWeight.w800, color: Colors.white)),
                        Text('Locked to scanning · ${widget.school}',
                            style: T.ui(9.5, color: Colors.white.withOpacity(.65))),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
                    decoration: BoxDecoration(
                      color: (s.online ? T.checker : T.alert).withOpacity(.25),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(s.online ? '● ONLINE' : '● OFFLINE · ${s.queued} queued',
                        style: T.ui(10, weight: FontWeight.w800,
                            color: s.online ? const Color(0xFF8FE0B0) : const Color(0xFFF3C98B))),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(s.eventName ?? 'No event selected', style: T.display(15)),
                StatusChip.green(s.timeIn ? 'Time-in' : 'Time-out'),
              ],
            ),
          ),
          // Full-height viewfinder — live camera; tap simulates when no camera
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: _useCamera
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: MobileScanner(
                        onDetect: _onDetect,
                        errorBuilder: (context, error, child) {
                          if (!_cameraFailed) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted) setState(() => _cameraFailed = true);
                            });
                          }
                          return const Viewfinder(
                            caption: 'HOLD YOUR QR UP TO THE CAMERA',
                            subCaption: 'RFID TAP ALSO WORKS',
                            bracketSize: 28,
                          );
                        },
                      ),
                    )
                  : const Viewfinder(
                      caption: 'CAMERA UNAVAILABLE',
                      subCaption: 'RFID TAP STILL WORKS',
                      bracketSize: 28,
                    ),
            ),
          ),
          // Success card
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 15),
              decoration: BoxDecoration(
                color: current == null
                    ? T.checker
                    : success
                        ? (current.forReview ? T.student : T.checker)
                        : (current.result == ScanResult.duplicate ? T.alert : T.danger),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(color: T.ink.withOpacity(.14), blurRadius: 24, offset: const Offset(0, 8)),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(.22),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      current == null || success
                          ? '✓'
                          : (current.result == ScanResult.duplicate ? '⟳' : '✕'),
                      style: T.ui(22, weight: FontWeight.w800, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          current == null || success
                              ? (success && current.forReview
                                  ? 'RECORDED — FOR REVIEW (${current.lateMinutes} MIN LATE)'
                                  : (s.timeIn ? 'TIME-IN RECORDED' : 'TIME-OUT RECORDED'))
                              : (current.result == ScanResult.duplicate
                                  ? 'ALREADY TIMED-IN'
                                  : 'NOT ON ROSTER'),
                          style: T.sectionLabel(color: Colors.white.withOpacity(.85), size: 9.5),
                        ),
                        const SizedBox(height: 2),
                        Text(current?.name ?? 'Waiting for first scan',
                            style: T.display(19, color: Colors.white, height: 1.1),
                            overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 2),
                        Text(
                            '${current?.course ?? 'Ready'} · ${s.scanned} scanned this event',
                            style: T.ui(11, color: Colors.white.withOpacity(.9))),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Exit instructions + hold-to-exit lock
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
            child: SafeArea(
              top: false,
              child: CampusCard(
                radius: 14,
                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 11),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text.rich(
                        TextSpan(children: [
                          const TextSpan(text: 'Device is locked to this screen.\n'),
                          TextSpan(text: 'Exit:', style: T.ui(10.5, weight: FontWeight.w800, color: T.text2)),
                          const TextSpan(text: ' hold the lock for 5 seconds'),
                        ]),
                        style: T.ui(10.5, color: T.text2, height: 1.5),
                      ),
                    ),
                    GestureDetector(
                      onTapDown: (_) => _startHold(),
                      onTapUp: (_) => _cancelHold(),
                      onTapCancel: _cancelHold,
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: _holding ? T.tint(T.checker, .25) : T.bg,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.lock, size: 17, color: _holding ? T.checkerDeep : T.ink),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
