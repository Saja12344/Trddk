"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import type { MapLatLng } from "./googleMapUtils";

export default function GoogleMapFitBounds({
  points,
  pointsKey,
  maxZoom = 15,
  padding = 48,
}: {
  points: MapLatLng[];
  pointsKey: string;
  maxZoom?: number;
  padding?: number;
}) {
  const map = useMap();
  const core = useMapsLibrary("core");

  useEffect(() => {
    if (!map || !core || points.length === 0) return;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(Math.min(maxZoom, 14));
      return;
    }

    const bounds = new core.LatLngBounds();
    for (const point of points) {
      bounds.extend(point);
    }
    map.fitBounds(bounds, padding);
    const listener = map.addListener("idle", () => {
      const currentZoom = map.getZoom();
      if (currentZoom != null && currentZoom > maxZoom) map.setZoom(maxZoom);
    });
    return () => listener.remove();
  }, [core, map, maxZoom, padding, points, pointsKey]);

  return null;
}
