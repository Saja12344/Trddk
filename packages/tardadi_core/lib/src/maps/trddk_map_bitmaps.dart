import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;

/// Renders a [IconData] glyph into a Google Maps bitmap marker.
Future<gmaps.BitmapDescriptor> bitmapFromMaterialIcon(
  IconData icon, {
  required Color color,
  int size = 48,
  Color? backgroundColor,
  double backgroundRadius = 0,
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final dimension = size.toDouble();

  if (backgroundColor != null && backgroundRadius > 0) {
    canvas.drawCircle(
      Offset(dimension / 2, dimension / 2),
      backgroundRadius,
      Paint()..color = backgroundColor,
    );
  }

  final textPainter = TextPainter(textDirection: TextDirection.ltr);
  textPainter.text = TextSpan(
    text: String.fromCharCode(icon.codePoint),
    style: TextStyle(
      fontSize: dimension * 0.62,
      fontFamily: icon.fontFamily,
      package: icon.fontPackage,
      color: color,
    ),
  );
  textPainter.layout();
  textPainter.paint(
    canvas,
    Offset(
      (dimension - textPainter.width) / 2,
      (dimension - textPainter.height) / 2,
    ),
  );

  final picture = recorder.endRecording();
  final image = await picture.toImage(size, size);
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return gmaps.BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
}

Future<gmaps.BitmapDescriptor> navigationArrowBitmap({
  Color color = Colors.white,
  int size = 68,
}) {
  return bitmapFromMaterialIcon(
    Icons.navigation_rounded,
    color: color,
    size: size,
  );
}

Future<gmaps.BitmapDescriptor> busMarkerBitmap({
  Color color = const Color(0xFFEA4F26),
  int size = 52,
}) {
  return bitmapFromMaterialIcon(
    Icons.directions_bus_rounded,
    color: Colors.white,
    size: size,
    backgroundColor: color,
    backgroundRadius: size * 0.42,
  );
}

Future<gmaps.BitmapDescriptor> stopMarkerBitmap({
  Color color = const Color(0xFF6AAEFF),
  int size = 36,
  bool highlighted = false,
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final dimension = size.toDouble();
  final center = Offset(dimension / 2, dimension / 2);
  final radius = dimension * (highlighted ? 0.32 : 0.26);

  if (highlighted) {
    canvas.drawCircle(
      center,
      dimension * 0.48,
      Paint()..color = color.withValues(alpha: 0.35),
    );
  }
  canvas.drawCircle(center, radius, Paint()..color = color);
  canvas.drawCircle(
    center,
    radius,
    Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2,
  );

  final picture = recorder.endRecording();
  final image = await picture.toImage(size, size);
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return gmaps.BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
}

Future<gmaps.BitmapDescriptor> passengerDotBitmap({
  Color color = const Color(0xFF4285F4),
  int size = 28,
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final dimension = size.toDouble();
  final center = Offset(dimension / 2, dimension / 2);

  canvas.drawCircle(
    center,
    dimension * 0.42,
    Paint()..color = color.withValues(alpha: 0.25),
  );
  canvas.drawCircle(
    center,
    dimension * 0.22,
    Paint()
      ..color = color
      ..style = PaintingStyle.fill,
  );
  canvas.drawCircle(
    center,
    dimension * 0.22,
    Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5,
  );

  final picture = recorder.endRecording();
  final image = await picture.toImage(size, size);
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return gmaps.BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
}
