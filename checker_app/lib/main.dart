import 'package:flutter/material.dart';
import 'data/live_repo.dart';
import 'theme.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  runApp(const CheckerApp());
}

class CheckerApp extends StatelessWidget {
  const CheckerApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'CSG Checker',
        debugShowCheckedModeBanner: false,
        theme: T.themeData(),
        home: const LoginScreen(),
      );
}
