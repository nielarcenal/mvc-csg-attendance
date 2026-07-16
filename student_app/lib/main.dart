import 'package:flutter/material.dart';
import 'data/live_repo.dart';
import 'theme.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  runApp(const StudentApp());
}

class StudentApp extends StatelessWidget {
  const StudentApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'CSG Events',
        debugShowCheckedModeBanner: false,
        theme: T.themeData(),
        home: const LoginScreen(),
      );
}
