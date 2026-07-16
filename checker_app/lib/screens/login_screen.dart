import 'package:flutter/material.dart';
import '../data/live_repo.dart' as repo;
import '../theme.dart';
import 'events_screen.dart';

/// Checker login — follows the 4c login pattern with the checker green accent.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (repo.hasBackend) {
      setState(() { _busy = true; _error = null; });
      final err = await repo.signIn(_email.text.trim(), _password.text);
      if (!mounted) return;
      if (err != null) {
        setState(() { _busy = false; _error = err; });
        return;
      }
    }
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const EventsScreen()),
    );
  }

  InputDecoration _decoration(String hint) => InputDecoration(
        hintText: hint,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: const BorderSide(color: T.hairline, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(13),
          borderSide: const BorderSide(color: T.accent, width: 2),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 26),
                child: Column(
                  children: [
                    const SizedBox(height: 80),
                    Container(
                      decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: T.emphasisShadow),
                      child: ClipOval(child: Image.asset('assets/sg-logo.png', width: 64, height: 64)),
                    ),
                    const SizedBox(height: 12),
                    Text('CSG Checker', style: T.display(24)),
                    const SizedBox(height: 3),
                    Text('MVC Central Student Government', style: T.ui(12, color: T.text2)),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: T.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: T.emphasisShadow,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionLabel('School email'),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            style: T.ui(13, weight: FontWeight.w600),
                            decoration: _decoration('j.ramos@mvc.edu.ph'),
                          ),
                          const SizedBox(height: 12),
                          const SectionLabel('Password'),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _password,
                            obscureText: true,
                            style: T.ui(13, weight: FontWeight.w800),
                            onSubmitted: (_) => _signIn(),
                            decoration: _decoration('••••••••'),
                          ),
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
                          PillButton(_busy ? 'Signing in…' : 'Sign in',
                              onTap: _busy ? () {} : _signIn),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
                      decoration: BoxDecoration(
                        color: T.tint(T.accent, .08),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        'Checker accounts are created by the event maker. You can only scan for events you are assigned to.',
                        textAlign: TextAlign.center,
                        style: T.ui(11, color: T.accentDeep, height: 1.55),
                      ),
                    ),
                    const SizedBox(height: 30),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text('v1.0 · S.Y. 2026–2027', style: T.ui(9.5, color: T.muted)),
            ),
          ],
        ),
      ),
    );
  }
}
