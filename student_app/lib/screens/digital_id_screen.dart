import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../theme.dart';
import '../data/live_repo.dart' as repo;
import '../data/models.dart';

/// 1b — Digital ID (QR v2, FEATURE_BATCH_2 A5).
///
/// Dynamic mode (default): a short-lived signed pass with a countdown ring
/// and a Generate/Regenerate button. Generating needs the internet BY
/// DESIGN — that is what kills screenshot sharing; checkers still validate
/// the pass fully offline. Static mode (admin-assigned): the printed-style
/// permanent token, rendered offline as before.
class DigitalIdScreen extends StatefulWidget {
  const DigitalIdScreen({super.key});

  @override
  State<DigitalIdScreen> createState() => _DigitalIdScreenState();
}

class _DigitalIdScreenState extends State<DigitalIdScreen> {
  repo.QrPass? _pass;
  String? _error;
  bool _generating = false;
  Timer? _tick;
  int _remaining = 0;

  @override
  void initState() {
    super.initState();
    // Session 11 addition #3: reopening the app (even offline) shows the
    // last issued pass — live countdown if still valid, honest grayed-out
    // "Code expired" otherwise. Never a fake-fresh code.
    repo.loadCachedQrPass().then((p) {
      if (!mounted || p == null || _pass != null) return;
      setState(() {
        _pass = p;
        _remaining = math.max(0, p.exp - _nowEpoch);
      });
      if (_remaining > 0) _startTicker();
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try { await repo.refreshAll(); } catch (_) {/* keep last loaded data */}
    if (mounted) setState(() {});
  }

  int get _nowEpoch => DateTime.now().toUtc().millisecondsSinceEpoch ~/ 1000;

  void _startTicker() {
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final p = _pass;
      if (p == null) return;
      setState(() => _remaining = math.max(0, p.exp - _nowEpoch));
      if (_remaining <= 0) _tick?.cancel();
    });
  }

  Future<void> _generate() async {
    if (_generating) return;
    setState(() { _generating = true; _error = null; });
    final res = await repo.issueQrPass();
    if (!mounted) return;
    if (res.pass == null) {
      setState(() { _generating = false; _error = res.error; });
      return;
    }
    _startTicker();
    setState(() {
      _generating = false;
      _pass = res.pass;
      _remaining = math.max(0, res.pass!.exp - _nowEpoch);
    });
  }

  @override
  Widget build(BuildContext context) {
    final dynamicMode = currentStudent.qrMode == 'dynamic';
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
            child: RefreshIndicator(
              color: T.accent,
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
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
                        if (!currentStudent.qrActive)
                          _qrBox(_message(
                              'Your QR is deactivated — please see the SG office.'))
                        else if (dynamicMode)
                          ..._dynamicQr()
                        else
                          _staticQr(),
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
                                child: Text(currentStudent.initials,
                                    style: T.ui(14, weight: FontWeight.w800, color: T.muted)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(currentStudent.fullName, style: T.display(19)),
                                const SizedBox(height: 3),
                                Text('${currentStudent.studentNo} · ${currentStudent.course}',
                                    style: T.ui(12, color: T.text2)),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (dynamicMode)
                              StatusChip.blue('Single-use · expires fast', fontSize: 10.5)
                            else
                              StatusChip.green('✓ Works offline', fontSize: 10.5),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (dynamicMode && currentStudent.qrActive) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
                      decoration: BoxDecoration(
                        color: T.tint(T.accent, .08),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        'Codes are single-use and expire quickly, so screenshots don’t work. '
                        'No signal at the gate? Ask the checker to look you up by name.',
                        textAlign: TextAlign.center,
                        style: T.ui(11, color: T.accentDeep, height: 1.55),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── dynamic mode widgets ──────────────────────────────────────────
  List<Widget> _dynamicQr() {
    final p = _pass;
    final expired = p != null && _remaining <= 0;
    return [
      Stack(
        alignment: Alignment.center,
        children: [
          Opacity(
            opacity: expired ? .18 : 1,
            child: _qrBox(p == null
                ? _message('Tap Generate to get your entry code.')
                : QrImageView(
                    data: p.pass,
                    version: QrVersions.auto,
                    size: 206,
                    gapless: true,
                    eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: T.ink),
                    dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square, color: T.ink),
                  )),
          ),
          if (expired)
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.timer_off_rounded, size: 30, color: T.muted),
                const SizedBox(height: 6),
                Text('Code expired', style: T.display(15)),
                Text('Generate a new code', style: T.ui(11.5, color: T.text2)),
              ],
            ),
        ],
      ),
      const SizedBox(height: 12),
      if (p != null && !expired) ...[
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 34,
              height: 34,
              child: CustomPaint(
                painter: _CountdownRing(_remaining / math.max(1, p.ttl)),
                child: Center(
                  child: Text('$_remaining',
                      style: T.ui(10, weight: FontWeight.w800, color: T.accentDeep)),
                ),
              ),
            ),
            const SizedBox(width: 9),
            Text('valid for $_remaining s', style: T.ui(11.5, color: T.text2)),
          ],
        ),
        const SizedBox(height: 10),
      ],
      if (_error != null) ...[
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: T.tint(T.danger, .1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(_error!,
              textAlign: TextAlign.center,
              style: T.ui(11, weight: FontWeight.w600, color: T.dangerDeep, height: 1.5)),
        ),
        const SizedBox(height: 10),
      ],
      PillButton(
        _generating
            ? 'Generating…'
            : p == null
                ? 'Generate my code'
                : expired
                    ? 'Generate a new code'
                    : 'Regenerate',
        busy: _generating,
        onTap: _generate,
      ),
    ];
  }

  Widget _staticQr() => _qrBox(currentStudent.qrToken.isEmpty
      ? _message(
          'No QR token on your record yet — ask the SG office to link your student number.')
      : QrImageView(
          data: currentStudent.qrToken,
          version: QrVersions.auto,
          size: 206,
          gapless: true,
          eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: T.ink),
          dataModuleStyle: const QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.square, color: T.ink),
        ));

  Widget _qrBox(Widget child) => Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: T.accent, width: 2.5),
          borderRadius: BorderRadius.circular(16),
        ),
        child: child,
      );

  Widget _message(String text) => SizedBox(
        width: 206,
        height: 206,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Text(text,
                textAlign: TextAlign.center,
                style: T.ui(12, color: T.text2, height: 1.5)),
          ),
        ),
      );
}

/// Remaining-time ring: blue arc that empties as the pass ages.
class _CountdownRing extends CustomPainter {
  _CountdownRing(this.fraction);

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..color = T.hairline2;
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..color = fraction < .2 ? T.alert : T.student;
    canvas.drawOval(rect.deflate(2), track);
    canvas.drawArc(rect.deflate(2), -math.pi / 2, 2 * math.pi * fraction.clamp(0, 1), false, arc);
  }

  @override
  bool shouldRepaint(_CountdownRing old) => old.fraction != fraction;
}
