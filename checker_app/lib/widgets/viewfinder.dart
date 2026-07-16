import 'package:flutter/material.dart';

/// Dark camera viewfinder: corner brackets + animated green scanline
/// (2.4s ease-in-out, alternating, top 6% → 90%). The camera feed itself is
/// simulated — plug in `mobile_scanner`'s preview here for production.
class Viewfinder extends StatefulWidget {
  const Viewfinder({
    super.key,
    this.caption = 'LIVE CAMERA FEED · POINT AT QR',
    this.subCaption,
    this.bracketSize = 24,
    this.radius = 20,
  });

  final String caption;
  final String? subCaption;
  final double bracketSize;
  final double radius;

  @override
  State<Viewfinder> createState() => _ViewfinderState();
}

class _ViewfinderState extends State<Viewfinder> with SingleTickerProviderStateMixin {
  late final AnimationController _scan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _scan.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.bracketSize;
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF12181D), Color(0xFF1A232B), Color(0xFF12181D)],
            stops: [0, .6, 1],
          ),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) => Stack(
            children: [
              // Corner brackets
              Positioned(top: 16, left: 16, child: _corner(b, top: true, left: true)),
              Positioned(top: 16, right: 16, child: _corner(b, top: true, left: false)),
              Positioned(bottom: 16, left: 16, child: _corner(b, top: false, left: true)),
              Positioned(bottom: 16, right: 16, child: _corner(b, top: false, left: false)),
              // Animated scanline
              AnimatedBuilder(
                animation: _scan,
                builder: (_, __) {
                  final h = constraints.maxHeight;
                  final top = h * (.06 + .84 * _scan.value);
                  return Positioned(
                    top: top,
                    left: constraints.maxWidth * .12,
                    right: constraints.maxWidth * .12,
                    child: Container(
                      height: 2.5,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        gradient: const LinearGradient(
                          colors: [Colors.transparent, Color(0xFF5FD48D), Colors.transparent],
                        ),
                      ),
                    ),
                  );
                },
              ),
              // Caption
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.caption,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.5,
                        color: Colors.white.withOpacity(.4),
                      ),
                    ),
                    if (widget.subCaption != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        widget.subCaption!,
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 8.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.1,
                          color: Colors.white.withOpacity(.28),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _corner(double size, {required bool top, required bool left}) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          border: Border(
            top: top ? const BorderSide(color: Colors.white, width: 3.5) : BorderSide.none,
            bottom: !top ? const BorderSide(color: Colors.white, width: 3.5) : BorderSide.none,
            left: left ? const BorderSide(color: Colors.white, width: 3.5) : BorderSide.none,
            right: !left ? const BorderSide(color: Colors.white, width: 3.5) : BorderSide.none,
          ),
          borderRadius: BorderRadius.only(
            topLeft: top && left ? const Radius.circular(6) : Radius.zero,
            topRight: top && !left ? const Radius.circular(6) : Radius.zero,
            bottomLeft: !top && left ? const Radius.circular(6) : Radius.zero,
            bottomRight: !top && !left ? const Radius.circular(6) : Radius.zero,
          ),
        ),
      );
}

/// ● ONLINE / ● OFFLINE pill for the green headers.
class NetPill extends StatelessWidget {
  const NetPill({super.key, required this.online, this.onTap});

  final bool online;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
          decoration: BoxDecoration(
            color: online ? Colors.white.withOpacity(.22) : const Color(0xFFE2913F),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            online ? '● ONLINE' : '● OFFLINE',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: .6,
            ),
          ),
        ),
      );
}
