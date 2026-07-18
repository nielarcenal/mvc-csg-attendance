import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../data/models.dart';
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
  final _reason = TextEditingController();
  bool _submitted = false;
  bool _busy = false;
  String? _reasonError; // inline under the field, not only a SnackBar (UX §3)
  final List<({String name, Uint8List bytes})> _attachments = [];

  List<HistoryEntry> get _missedAll =>
      historyEntries.where((h) => h.status == AttendanceStatus.absent).toList();
  HistoryEntry? _selected;
  HistoryEntry? get _missed => _selected ?? _missedAll.firstOrNull;

  void _pickEvent() {
    final options = _missedAll;
    if (options.length < 2) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: T.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 6),
              child: Text('Which event?', style: T.display(16)),
            ),
            for (final h in options)
              ListTile(
                title: Text(h.event, style: T.ui(13, weight: FontWeight.w700)),
                subtitle: Text(h.line, style: T.ui(10.5, color: T.text2)),
                trailing: _missed == h ? const Icon(Icons.check_rounded, size: 18) : null,
                onTap: () {
                  setState(() => _selected = h);
                  Navigator.of(ctx).pop();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _pickPhoto() async {
    final picked = await ImagePicker()
        .pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    setState(() => _attachments.add((name: picked.name, bytes: bytes)));
  }

  Future<void> _submit() async {
    if (_busy || _submitted) return;
    if (_missed == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No missed event to excuse.')),
      );
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _reasonError = 'A reason is required');
      return;
    }
    setState(() { _busy = true; _reasonError = null; });
    String? err;
    final urls = <String>[];
    try {
      for (final a in _attachments) {
        urls.add(await repo.uploadExcuseAttachment(a.bytes, a.name));
      }
    } catch (e) {
      err = 'Could not upload attachment: $e';
    }
    err ??= await repo.submitExcuse(_missed?.eventId, _reason.text.trim(), attachmentUrls: urls);
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
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(_missed?.event ?? 'No missed events',
                                      style: T.ui(14, weight: FontWeight.w700)),
                                  const SizedBox(height: 1),
                                  Text(
                                      _missed != null
                                          ? '${_missed!.line}${_missed!.fine != null ? ' · ${_missed!.fine}' : ''}'
                                          : 'You have nothing to excuse right now.',
                                      style: T.ui(10.5, color: T.text2)),
                                ],
                              ),
                            ),
                            if (_missedAll.length > 1)
                              GestureDetector(
                                onTap: _pickEvent,
                                child: Text('Change ▾',
                                    style: T.ui(11, weight: FontWeight.w700, color: T.accentDeep)),
                              ),
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
                            border: Border.all(
                                color: _reasonError != null ? T.danger : T.hairline,
                                width: 1.5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: TextField(
                            controller: _reason,
                            maxLines: 4,
                            maxLength: 500,
                            onChanged: (_) => setState(() {
                              if (_reason.text.trim().isNotEmpty) _reasonError = null;
                            }),
                            style: T.ui(12.5, height: 1.5),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              counterText: '',
                              contentPadding: EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            if (_reasonError != null)
                              Text(_reasonError!,
                                  style: T.ui(10.5, weight: FontWeight.w600, color: T.dangerDeep)),
                            const Spacer(),
                            Text('${_reason.text.length} / 500',
                                style: T.ui(9.5, color: T.muted)),
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
                        const SectionLabel('Attachment'),
                        const SizedBox(height: 8),
                        for (var i = 0; i < _attachments.length; i++) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              border: Border.all(color: T.hairline, width: 1.5),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: Image.memory(_attachments[i].bytes,
                                      width: 44, height: 44, fit: BoxFit.cover),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(_attachments[i].name,
                                          style: T.ui(12, weight: FontWeight.w700),
                                          overflow: TextOverflow.ellipsis),
                                      Text(
                                          '${(_attachments[i].bytes.length / (1024 * 1024)).toStringAsFixed(1)} MB · ready to upload',
                                          style: T.ui(10, color: T.text2)),
                                    ],
                                  ),
                                ),
                                GestureDetector(
                                  onTap: () => setState(() => _attachments.removeAt(i)),
                                  child: Text('✕',
                                      style: T.ui(12, weight: FontWeight.w700, color: T.dangerDeep)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],
                        GestureDetector(
                          onTap: _pickPhoto,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 11),
                            decoration: BoxDecoration(
                              border: Border.all(color: const Color(0xFFCFD6D2), width: 1.5,
                                  style: BorderStyle.solid),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                                _attachments.isEmpty ? '+ Add a photo' : '+ Add another photo',
                                style: T.ui(11, weight: FontWeight.w700, color: T.text2)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      'Reviewed by the event maker within 3 school days. If approved, the absence is excused and the fine is waived.',
                      style: T.ui(10.5, color: T.text2, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 12),
                  PillButton(
                      _submitted ? 'Submitted ✓' : (_busy ? 'Submitting…' : 'Submit excuse'),
                      color: _submitted ? T.checker : T.accent,
                      busy: _busy,
                      onTap: _submit),
                  for (final x in excuseRecords) ...[
                    const SizedBox(height: 12),
                    CampusCard(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(x.event, style: T.ui(12, weight: FontWeight.w700)),
                              const SizedBox(height: 1),
                              Text(x.line, style: T.ui(10, color: T.text2)),
                            ],
                          ),
                          switch (x.status) {
                            'approved' => StatusChip.green('Approved ✓'),
                            'rejected' => StatusChip.red('Rejected'),
                            _ => StatusChip.orange('Pending'),
                          },
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
