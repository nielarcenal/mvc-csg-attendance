import 'package:flutter/material.dart';
import '../data/live_repo.dart' as repo;
import '../theme.dart';

/// Change password (Session 11 / UX §3): requires the current password,
/// the new password twice, visibility toggles on every field, and live
/// rule hints that flip green as they are satisfied.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  static const _minLength = 8;

  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _showCurrent = false, _showNext = false, _showConfirm = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Live rule hints re-evaluate on every keystroke.
    _current.addListener(_onEdit);
    _next.addListener(_onEdit);
    _confirm.addListener(_onEdit);
  }

  void _onEdit() => setState(() => _error = null);

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool get _longEnough => _next.text.length >= _minLength;
  bool get _differsFromCurrent =>
      _next.text.isNotEmpty && _next.text != _current.text;
  bool get _matches => _confirm.text.isNotEmpty && _confirm.text == _next.text;
  bool get _ready =>
      _current.text.isNotEmpty && _longEnough && _differsFromCurrent && _matches;

  Future<void> _submit() async {
    if (!_ready || _busy) return;
    setState(() { _busy = true; _error = null; });
    final err = await repo.changePassword(_current.text, _next.text);
    if (!mounted) return;
    if (err != null) {
      setState(() { _busy = false; _error = err; });
      return;
    }
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: T.darkCard,
      content: Text('Password changed — use it on your next sign-in.',
          style: T.ui(12, color: Colors.white)),
    ));
  }

  InputDecoration _decoration({required bool shown, required VoidCallback onToggle}) =>
      InputDecoration(
        hintText: '••••••••',
        hintStyle: T.ui(13, color: T.muted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        suffixIcon: IconButton(
          tooltip: shown ? 'Hide password' : 'Show password',
          icon: Icon(shown ? Icons.visibility_off : Icons.visibility,
              size: 19, color: T.muted),
          onPressed: onToggle,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: const BorderSide(color: T.hairline, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: const BorderSide(color: T.accent, width: 2),
        ),
      );

  Widget _rule(String text, bool ok, {bool pending = false}) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          children: [
            Icon(ok ? Icons.check_circle_rounded : Icons.circle_outlined,
                size: 14, color: ok ? T.checkerDeep : (pending ? T.muted : T.muted)),
            const SizedBox(width: 6),
            Text(text, style: T.ui(11, color: ok ? T.checkerDeep : T.text2)),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: T.bg,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(color: T.ink),
        title: Text('Change password', style: T.display(17)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          children: [
            CampusCard(
              radius: 20,
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionLabel('Current password'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _current,
                    obscureText: !_showCurrent,
                    autofillHints: const [AutofillHints.password],
                    style: T.ui(13, weight: FontWeight.w800),
                    decoration: _decoration(
                      shown: _showCurrent,
                      onToggle: () => setState(() => _showCurrent = !_showCurrent),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const SectionLabel('New password'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _next,
                    obscureText: !_showNext,
                    autofillHints: const [AutofillHints.newPassword],
                    style: T.ui(13, weight: FontWeight.w800),
                    decoration: _decoration(
                      shown: _showNext,
                      onToggle: () => setState(() => _showNext = !_showNext),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const SectionLabel('New password again'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _confirm,
                    obscureText: !_showConfirm,
                    autofillHints: const [AutofillHints.newPassword],
                    style: T.ui(13, weight: FontWeight.w800),
                    onSubmitted: (_) => _submit(),
                    decoration: _decoration(
                      shown: _showConfirm,
                      onToggle: () => setState(() => _showConfirm = !_showConfirm),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _rule('At least $_minLength characters', _longEnough),
                  _rule('Different from your current password',
                      _differsFromCurrent, pending: _next.text.isEmpty),
                  _rule('Both new passwords match', _matches,
                      pending: _confirm.text.isEmpty),
                  if (_error != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                      decoration: BoxDecoration(
                        color: T.tint(T.danger, .1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(_error!,
                          style: T.ui(11, weight: FontWeight.w600, color: T.dangerDeep)),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Opacity(
                    opacity: _ready || _busy ? 1 : .45,
                    child: PillButton(
                      _busy ? 'Changing…' : 'Change password',
                      busy: _busy,
                      onTap: _ready ? _submit : null,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
              decoration: BoxDecoration(
                color: T.tint(T.accent, .08),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                'You stay signed in on this phone. Other devices will need the new password.',
                textAlign: TextAlign.center,
                style: T.ui(11, color: T.accentDeep, height: 1.55),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
