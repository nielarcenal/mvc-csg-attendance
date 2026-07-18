import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// 1b "Campus" design tokens — checker app (green accent).
abstract final class T {
  // Neutrals
  static const bg = Color(0xFFF4F6F5);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF232A31);
  static const text2 = Color(0xFF6B7580);
  static const muted = Color(0xFF9AA4AD);
  static const hairline = Color(0xFFE5E9E7);
  static const hairline2 = Color(0xFFEEF1EF);
  static const darkCard = Color(0xFF232A31);

  // Role accents
  static const student = Color(0xFF3F9BD8);
  static const studentDeep = Color(0xFF2B6DA0);
  static const checker = Color(0xFF35A463);
  static const checkerDeep = Color(0xFF25794A);
  static const maker = Color(0xFF8E5FAE);
  static const makerDeep = Color(0xFF6D4487);
  static const alert = Color(0xFFE2913F);
  static const alertDeep = Color(0xFFB07714);
  static const danger = Color(0xFFD95950);
  static const dangerDeep = Color(0xFFB13C34);

  /// Accent of this app.
  static const accent = checker;
  static const accentDeep = checkerDeep;

  static Color tint(Color c, [double a = .12]) => c.withOpacity(a);

  // Type
  static TextStyle display(double size, {Color color = ink, double? height}) =>
      GoogleFonts.bricolageGrotesque(
          fontSize: size, fontWeight: FontWeight.w700, color: color, height: height);

  static TextStyle ui(double size,
          {FontWeight weight = FontWeight.w400, Color color = ink, double? height}) =>
      GoogleFonts.plusJakartaSans(
          fontSize: size, fontWeight: weight, color: color, height: height);

  static TextStyle sectionLabel({Color color = muted, double size = 9.5}) =>
      GoogleFonts.plusJakartaSans(
          fontSize: size, fontWeight: FontWeight.w800, color: color, letterSpacing: size * .08);

  // Shadows
  static List<BoxShadow> get restShadow => [
        BoxShadow(
            color: ink.withOpacity(.05), blurRadius: 12, offset: const Offset(0, 3)),
      ];
  static List<BoxShadow> get emphasisShadow => [
        BoxShadow(
            color: ink.withOpacity(.08), blurRadius: 24, offset: const Offset(0, 6)),
      ];
  static List<BoxShadow> glow(Color c) => [
        BoxShadow(color: c.withOpacity(.35), blurRadius: 22, offset: const Offset(0, 8)),
      ];

  static ThemeData themeData() => ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: bg,
        colorScheme: ColorScheme.fromSeed(seedColor: accent, surface: bg),
        textTheme: GoogleFonts.plusJakartaSansTextTheme(),
        splashFactory: InkSparkle.splashFactory,
      );
}

/// White rounded card with the resting shadow.
class CampusCard extends StatelessWidget {
  const CampusCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(15),
    this.radius = 16,
    this.color = T.surface,
    this.shadows,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color color;
  final List<BoxShadow>? shadows;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: shadows ?? T.restShadow,
      ),
      child: child,
    );
    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: card);
  }
}

/// Small tinted status chip (e.g. "Present ✓", "₱50 · unpaid").
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, required this.bg, required this.fg, this.fontSize = 10});

  final String label;
  final Color bg;
  final Color fg;
  final double fontSize;

  StatusChip.green(String label, {Key? key, double fontSize = 10})
      : this(label, key: key, bg: T.tint(T.checker), fg: T.checkerDeep, fontSize: fontSize);
  StatusChip.blue(String label, {Key? key, double fontSize = 10})
      : this(label, key: key, bg: T.tint(T.student), fg: T.studentDeep, fontSize: fontSize);
  StatusChip.orange(String label, {Key? key, double fontSize = 10})
      : this(label, key: key, bg: T.tint(T.alert, .14), fg: T.alertDeep, fontSize: fontSize);
  StatusChip.red(String label, {Key? key, double fontSize = 10})
      : this(label, key: key, bg: T.tint(T.danger), fg: T.dangerDeep, fontSize: fontSize);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
        child: Text(label, style: T.ui(fontSize, weight: FontWeight.w800, color: fg)),
      );
}

/// Outlined pill chip (e.g. "RSVP", "File an excuse →").
class OutlineChip extends StatelessWidget {
  const OutlineChip(this.label,
      {super.key, this.color = T.student, this.textColor = T.studentDeep, this.onTap, this.fontSize = 10});

  final String label;
  final Color color;
  final Color textColor;
  final VoidCallback? onTap;
  final double fontSize;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            border: Border.all(color: color, width: 1.5),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(label, style: T.ui(fontSize, weight: FontWeight.w800, color: textColor)),
        ),
      );
}

/// Full-width filled pill button with a colored glow. While [busy] it shows
/// an inline 16px spinner next to the label and ignores taps (UX §3).
class PillButton extends StatelessWidget {
  const PillButton(this.label,
      {super.key, this.color = T.accent, this.textColor = Colors.white, this.onTap,
       this.fontSize = 13.5, this.busy = false});

  final String label;
  final Color color;
  final Color textColor;
  final VoidCallback? onTap;
  final double fontSize;
  final bool busy;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: busy ? null : onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: busy ? color.withOpacity(.75) : color,
            borderRadius: BorderRadius.circular(99),
            boxShadow: T.glow(color),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy) ...[
                SizedBox(
                  width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: textColor),
                ),
                const SizedBox(width: 10),
              ],
              Text(label, style: T.ui(fontSize, weight: FontWeight.w800, color: textColor)),
            ],
          ),
        ),
      );
}

/// UX §2/§4 confirmation dialog: Cancel is the default action; the confirm
/// button restates the verb and goes red when destructive.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String body,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: T.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      title: Text(title, style: T.display(17)),
      content: Text(body, style: T.ui(12.5, color: T.text2, height: 1.5)),
      actions: [
        TextButton(
          autofocus: true,
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text('Cancel', style: T.ui(12.5, weight: FontWeight.w700, color: T.text2)),
        ),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmLabel,
              style: T.ui(12.5, weight: FontWeight.w800,
                  color: destructive ? T.dangerDeep : T.accentDeep)),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// Ghost (outlined) pill button.
class GhostButton extends StatelessWidget {
  const GhostButton(this.label, {super.key, this.onTap, this.fontSize = 12});

  final String label;
  final VoidCallback? onTap;
  final double fontSize;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 18),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFD5DCD8), width: 1.5),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(label, style: T.ui(fontSize, weight: FontWeight.w700, color: T.text2)),
        ),
      );
}

/// Round white back button used on sub-screens.
class BackDot extends StatelessWidget {
  const BackDot({super.key});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => Navigator.of(context).maybePop(),
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: T.surface,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: T.ink.withOpacity(.08), blurRadius: 8, offset: const Offset(0, 2)),
            ],
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.arrow_back, size: 17, color: T.text2),
        ),
      );
}

/// UPPERCASE section label (9–10px, 800, letterspaced).
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.color = T.muted});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: T.sectionLabel(color: color));
}
