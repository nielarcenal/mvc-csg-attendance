import 'package:flutter/material.dart';
import 'data/live_repo.dart' as repo;
import 'theme.dart';
import 'screens/events_screen.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await repo.initSupabase();
  runApp(const CheckerApp());
}

class CheckerApp extends StatelessWidget {
  const CheckerApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'CSG Checker',
        debugShowCheckedModeBanner: false,
        theme: T.themeData(),
        home: const _Root(),
      );
}

/// Restores a persisted session: straight to My events when signed in.
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
      repo.restoreSession().then((ok) {
        if (mounted) setState(() { _signedIn = ok; _checking = false; });
      }).catchError((_) {
        if (mounted) setState(() => _checking = false);
      });
    } else {
      _checking = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: T.accent)),
      );
    }
    return _signedIn ? const EventsScreen() : const LoginScreen();
  }
}
