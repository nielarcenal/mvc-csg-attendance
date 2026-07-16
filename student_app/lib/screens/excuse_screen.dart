import 'package:flutter/material.dart';
import '../data/demo_data.dart';
import '../data/live_repo.dart' as repo;
import '../theme.dart';

/// 2a — Excuse submission: event picker, reason textarea with counter,
/// attachments, review-SLA note, submit, previous excuse status.
class ExcuseScreen extends StatefulWidget {
  const ExcuseScreen({super.key});

  @override
  State<ExcuseScreen> createState() => _ExcuseScreenState();
}

class _ExcuseScreenState extends State<ExcuseScreen> {
  final _reason = TextEditingController(
      text: repo.hasBackend
          ? ''
          : 'I was confined at the campus clinic due to fever. Attached is my medical certificate signed by the school nurse.');
  bool _submitted = false;
  bool _busy = false;

  HistoryEntry? get _missed =>
      historyEntries.where((h) => h.status == AttendanceStatus.absent).firstOrNull;

  Future<void> _submit() async {
    if (_busy || _submitted) return;
    if (repo.hasBackend && _reason.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please write a reason first.')),
      );
      return;
    }
    setState(() => _busy = true);
    final err = await repo.submitExcuse(null, _reason.text.trim());
    if (!mounted) return;
    setState(() { _busy = false; _submitted = err == null; });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(err ?? 'Excuse submitted — pending review',
            style: T.ui(12, color: Colors.white)),
        backgroundColor: err == null ? T.darkCard : T.dangerDeep,
      ),
    );
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
                  Text('File an excuse', style: T.display(20)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
                children: [
                  CampusCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionLabel('Event missed'),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_missed?.event ?? 'Community Cleanup',
                                    style: T.ui(14, weight: FontWeight.w700)),
                                const SizedBox(height: 1),
                                Text(
                                    _missed != null
                                        ? '${_missed!.line}${_missed!.fine != null ? ' · ${_missed!.fine}' : ''}'
                                        : 'Jul 8, 2026 · marked absent · ₱50 fine pending',
                                    style: T.ui(10.5, color: T.text2)),
                              ],
                            ),
                            Text('Change ▾', style: T.ui(11, weight: FontWeight.w700, color: T.accentDeep)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CampusCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionLabel('Reason'),
                        const SizedBox(height: 8),
                        Container(
                          decoration: BoxDecoration(
                            border: Border.all(color: T.hairline, width: 1.5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: TextField(
                            controller: _reason,
                            maxLines: 4,
                            maxLength: 500,
                            onChanged: (_) => setState(() {}),
                            style: T.ui(12.5, height: 1.5),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              counterText: '',
                              contentPadding: EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text('${_reason.text.length} / 500',
                              style: T.ui(9.5, color: T.muted)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CampusCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionLabel('Attachment'),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            border: Border.all(color: T.hairline, width: 1.5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: T.hairline2,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                alignment: Alignment.center,
                                child: Text('MED\nCERT',
                                    textAlign: TextAlign.center,
                                    style: T.ui(7, weight: FontWeight.w600, color: T.muted)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('med-cert-jul8.jpg', style: T.ui(12, weight: FontWeight.w700)),
                                    Text('1.2 MB · uploaded', style: T.ui(10, color: T.text2)),
                                  ],
                                ),
                              ),
                              Text('✕', style: T.ui(12, weight: FontWeight.w700, color: T.dangerDeep)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFCFD6D2), width: 1.5,
                                style: BorderStyle.solid),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          alignment: Alignment.center,
                          child: Text('+ Add another photo',
                              style: T.ui(11, weight: FontWeight.w700, color: T.text2)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      'Reviewed by the event maker within 3 school days. If approved, the absence is excused and the ₱50 fine is waived.',
                      style: T.ui(10.5, color: T.text2, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 12),
                  PillButton(
                      _submitted ? 'Submitted ✓' : (_busy ? 'Submitting…' : 'Submit excuse'),
                      color: _submitted ? T.checker : T.accent,
                      onTap: _submit),
                  const SizedBox(height: 12),
                  CampusCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Sports Fest — Day 1', style: T.ui(12, weight: FontWeight.w700)),
                            const SizedBox(height: 1),
                            Text('Filed Jun 27 · reviewed by R. Uy', style: T.ui(10, color: T.text2)),
                          ],
                        ),
                        StatusChip.green('Approved ✓'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
