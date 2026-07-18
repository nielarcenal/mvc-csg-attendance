import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../theme.dart';
import '../data/live_repo.dart' as repo;
import '../data/models.dart';

/// 1b — Digital ID: official-ID card with the student's QR. The QR encodes
/// the locally cached `qr_token` (never the student number), so it renders
/// fully offline.
class DigitalIdScreen extends StatefulWidget {
  const DigitalIdScreen({super.key});

  @override
  State<DigitalIdScreen> createState() => _DigitalIdScreenState();
}

class _DigitalIdScreenState extends State<DigitalIdScreen> {

  Future<void> _refresh() async {
    try { await repo.refreshAll(); } catch (_) {/* keep last loaded data */}
    if (mounted) setState(() {});
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
                      // QR in the blue frame
                      Container(
                        padding: const EdgeInsets.all(11),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: T.accent, width: 2.5),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: currentStudent.qrToken.isEmpty
                            ? SizedBox(
                                width: 206,
                                height: 206,
                                child: Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(20),
                                    child: Text(
                                      'No QR token on your record yet — ask the SG office to link your student number.',
                                      textAlign: TextAlign.center,
                                      style: T.ui(12, color: T.text2, height: 1.5),
                                    ),
                                  ),
                                ),
                              )
                            : QrImageView(
                                data: currentStudent.qrToken,
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
                          StatusChip.green('✓ Works offline', fontSize: 10.5),
                        ],
                      ),
                    ],
                  ),
                ),
                // Next event card — real hero event only.
                if (heroEvent != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                    decoration: BoxDecoration(
                      color: T.accent,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(heroEvent!.label.toUpperCase(),
                            style: T.sectionLabel(color: Colors.white.withOpacity(.85), size: 10)),
                        const SizedBox(height: 3),
                        Text(heroEvent!.name, style: T.display(16, color: Colors.white)),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(.22),
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                              '${heroEvent!.isRequired ? 'Required' : 'Optional'} · ${heroEvent!.line}',
                              style: T.ui(10.5, weight: FontWeight.w700, color: Colors.white)),
                        ),
                      ],
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
}
