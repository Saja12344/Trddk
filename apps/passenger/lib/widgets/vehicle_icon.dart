import 'package:flutter/material.dart';

import '../models/route_list_item.dart';

/// Vehicle artwork shared with the driver app
/// (apps/driver/assets/images/vehicles/*.png), tinted to [color].
class VehicleIcon extends StatelessWidget {
  const VehicleIcon({
    super.key,
    required this.vehicleType,
    required this.color,
    this.size = 24,
  });

  final VehicleType vehicleType;
  final Color color;

  /// Width of the artwork (the images are wider than tall).
  final double size;

  static String assetFor(VehicleType type) {
    return switch (type) {
      VehicleType.golfCar => 'assets/images/vehicles/golf.png',
      VehicleType.bus => 'assets/images/vehicles/bus.png',
      VehicleType.vanCar => 'assets/images/vehicles/van.png',
    };
  }

  /// Material fallback, kept for places that need an [IconData].
  static IconData iconFor(VehicleType type) {
    return switch (type) {
      VehicleType.golfCar => Icons.electric_car,
      VehicleType.bus => Icons.directions_bus_filled,
      VehicleType.vanCar => Icons.airport_shuttle,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      assetFor(vehicleType),
      width: size,
      fit: BoxFit.contain,
      color: color,
      colorBlendMode: BlendMode.srcIn,
      filterQuality: FilterQuality.medium,
      errorBuilder: (_, _, _) =>
          Icon(iconFor(vehicleType), color: color, size: size * 0.8),
    );
  }
}
