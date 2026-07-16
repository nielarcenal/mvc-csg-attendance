import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../theme.dart';
import '../data/demo_data.dart';

/// 1b — Digital ID: official-ID card with the rotating QR (30s TOTP-style
/// refresh while online, static fallback offline). The QR encodes the
/// rotating `qr_token`, never the student number.
class DigitalIdScreen extends StatefulWidget {
  const DigitalIdScreen({super.key});

  @override
  State<DigitalIdScreen> createState() => _DigitalIdScreenState();
}

class _DigitalIdScreenState extends State<DigitalIdScreen>
    with SingleTickerProviderStateMixin {
  static const _period = Duration(seconds: 30);
  late final AnimationController _cycle =
      AnimationController(vsync: this, duration: _period)
        ..addStatusListener((status) {
          if (status == AnimationStatus.completed) {
            setState(() => _epoch++); // rotate the token
            _cycle.forward(from: 0);
          }
        })
        ..forward();
  int _epoch = 0;

  /// Rotating payload — in production a TOTP derived from `qr_token`.
  String get _payload => '${demoStudent.qrToken}:$_epoch';

  @override
  void dispose() {
    _cycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Digital ID', style: T.display(24)),
                ClipOval(child: Image.asset('assets/sg-logo.png', width: 30, height: 30)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: T.surface,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: T.emphasisShadow,
                  ),
                  child: Column(
                    children: [
                      // QR in the blue frame
                      Container(
                        padding: const EdgeInsets.all(11),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: T.accent, width: 2.5),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: QrImageView(
                          data: _payload,
                          version: QrVersions.auto,
                          size: 206,
                          gapless: true,
                          eyeStyle: const QrEyeStyle(
                              eyeShape: QrEyeShape.square, color: T.ink),
                          dataModuleStyle: const QrDataModuleStyle(
                              dataModuleShape: QrDataModuleShape.square, color: T.ink),
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Countdown pill with conic ring
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: T.tint(T.accent, .1),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            AnimatedBuilder(
                              animation: _cycle,
                              builder: (_, __) => CustomPaint(
                                size: const Size(16, 16),
                                painter: _RingPainter(1 - _cycle.value),
                              ),
                            ),
                            const SizedBox(width: 7),
                            AnimatedBuilder(
                              animation: _cycle,
                              builder: (_, __) {
                                final left =
                                    (_period.inSeconds * (1 - _cycle.value)).ceil();
                                return Text(
                                  'Refreshes in 0:${left.toString().padLeft(2, '0')}',
                                  style: T.ui(11, weight: FontWeight.w600, color: T.accentDeep),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Photo + identity
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                              border: Border.all(color: T.accent, width: 2.5),
                            ),
                            child: CircleAvatar(
                              backgroundColor: T.hairline2,
                              child: Text('JD', style: T.ui(14, weight: FontWeight.w800, color: T.muted)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(demoStudent.fullName, style: T.display(19)),
                              const SizedBox(height: 3),
                              Text('${demoStudent.studentNo} · ${demoStudent.course}',
                                  style: T.ui(12, color: T.text2)),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          StatusChip.green('✓ Works offline', fontSize: 10.5),
                          const SizedBox(width: 8),
                          StatusChip.blue('Brightness up', fontSize: 10.5),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // Next event card
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                  decoration: BoxDecoration(
                    color: T.accent,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('TOMORROW · 7:00 AM · MVC GYM',
                          style: T.sectionLabel(color: Colors.white.withOpacity(.85), size: 10)),
                      const SizedBox(height: 3),
                      Text('SG General Assembly', style: T.display(16, color: Colors.white)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(.22),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text('Required · check-in 7:00–8:15',
                            style: T.ui(10.5, weight: FontWeight.w700, color: Colors.white)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Conic countdown ring (blue arc over a faint track).
class _RingPainter extends CustomPainter {
  _RingPainter(this.fraction);

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final track = Paint()..color = T.accent.withOpacity(.18);
    canvas.drawOval(rect, track);
    final arc = Paint()..color = T.accent;
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * fraction, true, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction;
}
