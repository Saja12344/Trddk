"use client";

import { useMemo } from "react";
import { AdvancedMarker, Map, Polyline } from "@vis.gl/react-google-maps";
import type { LatLngExpression } from "leaflet";
import GoogleMapFitBounds from "@/components/maps/GoogleMapFitBounds";
import { toMapLatLng, toMapLatLngList } from "@/components/maps/googleMapUtils";
import { getGoogleMapsClientConfig } from "@/lib/googleMapsConfig";
import { GOOGLE_MAP_BASE_PROPS } from "@/lib/googleMapDefaults";
import { ROUTE_LINE } from "@/lib/mapConfig";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  type MapMarker,
} from "@/lib/mapUtils";

type MapViewGoogleProps = {
  markers?: MapMarker[];
  polyline?: LatLngExpression[];
  className?: string;
  height?: number | string;
};

function MapViewGoogleMap({
  markers = [],
  polyline,
  className = "",
  height = 360,
}: MapViewGoogleProps) {
  const { mapId } = getGoogleMapsClientConfig();
  const points = useMemo(() => markers.map((marker) => toMapLatLng(marker.position)), [markers]);
  const pointsKey = useMemo(
    () => points.map((p) => `${p.lat},${p.lng}`).join("|"),
    [points]
  );
  const linePoints =
    polyline && polyline.length > 1
      ? polyline
      : markers.length > 1
        ? markers.map((marker) => marker.position)
        : undefined;

  return (
    <div
      className={`map-container ${className}`}
      style={{ height, width: "100%" }}
    >
      <Map
        {...GOOGLE_MAP_BASE_PROPS}
        mapId={mapId}
        className="google-map-canvas"
        style={{ height: "100%", width: "100%", borderRadius: 12 }}
        defaultCenter={toMapLatLng(DEFAULT_MAP_CENTER)}
        defaultZoom={DEFAULT_MAP_ZOOM}
      >
        <GoogleMapFitBounds points={points} pointsKey={pointsKey} maxZoom={DEFAULT_MAP_ZOOM} />

        {linePoints && linePoints.length > 1 && (
          <Polyline
            path={toMapLatLngList(linePoints)}
            strokeColor={ROUTE_LINE.color}
            strokeWeight={ROUTE_LINE.weight}
            strokeOpacity={ROUTE_LINE.opacity}
          />
        )}

        {markers.map((marker) => (
          <AdvancedMarker
            key={marker.id}
            position={toMapLatLng(marker.position)}
            title={marker.label}
          >
            <span
              className={
                marker.kind === "bus"
                  ? "bus-pin"
                  : marker.kind === "from"
                    ? "endpoint-pin endpoint-pin-from"
                    : marker.kind === "to"
                      ? "endpoint-pin endpoint-pin-to"
                      : "stop-pin"
              }
              aria-hidden="true"
            />
          </AdvancedMarker>
        ))}
      </Map>
    </div>
  );
}

export default function MapViewGoogle(props: MapViewGoogleProps) {
  return <MapViewGoogleMap {...props} />;
}
