import 'package:flutter/material.dart';
import 'data/live_repo.dart' as repo;
import 'theme.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await repo.initSupabase();
  runApp(const StudentApp());
}

class StudentApp extends StatelessWidget {
  const StudentApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'CSG Events',
        debugShowCheckedModeBanner: false,
        theme: T.themeData(),
        home: const _Root(),
      );
}

/// Restores a persisted session: straight to Home when already signed in.
class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool _checking = repo.hasBackend;
  bool _signedIn = false;

  @override
  void initState() {
    super.initState();
    if (repo.hasBackend && repo.isSignedIn) {
      repo.refreshAll().then((_) {
        if (mounted) setState(() { _signedIn = true; _checking = false; });
      }).catchError((_) {
        if (mounted) setState(() => _checking = false);
      });
    } else {
      _checking = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!repo.hasBackend) return const _ConfigMissing();
    if (_checking) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: T.accent)),
      );
    }
    return _signedIn ? const HomeShell() : const LoginScreen();
  }
}

/// No backend → no fake data (CLAUDE.md hard rule 1): explain how to
/// configure instead of rendering sample screens.
class _ConfigMissing extends StatelessWidget {
  const _ConfigMissing();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('App not configured', style: T.display(20)),
              const SizedBox(height: 10),
              Text(
                'This build has no Supabase backend. Rebuild with\n'
                '--dart-define=SUPABASE_URL=… and\n'
                '--dart-define=SUPABASE_ANON_KEY=…',
                textAlign: TextAlign.center,
                style: T.ui(12, color: T.text2, height: 1.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
