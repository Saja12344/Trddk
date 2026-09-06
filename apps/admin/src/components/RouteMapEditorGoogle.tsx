"use client";

import { useMemo } from "react";
import { AdvancedMarker, Map, Polyline } from "@vis.gl/react-google-maps";
import type { LatLngExpression } from "leaflet";
import type { LocationPlace } from "@tardadi/shared";
import GoogleMapFitBounds from "@/components/maps/GoogleMapFitBounds";
import { toMapLatLng, toMapLatLngList } from "@/components/maps/googleMapUtils";
import { getGoogleMapProps } from "@/lib/googleMapDefaults";
import { ROUTE_LINE } from "@/lib/mapConfig";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, type MapMarker } from "@/lib/mapUtils";
import type { PickMode } from "./RouteMapEditorInner";

type RouteMapEditorGoogleProps = {
  fromLocation: LocationPlace | null;
  toLocation: LocationPlace | null;
  pickMode: PickMode;
  roadPolyline?: LatLngExpression[];
  extraMarkers?: MapMarker[];
  onMapPick: (lat: number, lng: number) => void;
  onMarkerDrag: (kind: "from" | "to", lat: number, lng: number) => void;
};

function RouteMapEditorGoogleMap({
  fromLocation,
  toLocation,
  pickMode,
  roadPolyline,
  extraMarkers = [],
  onMapPick,
  onMarkerDrag,
}: RouteMapEditorGoogleProps) {
  const fitPoints = useMemo(() => {
    const pts = [
      ...(fromLocation
        ? [{ lat: fromLocation.latitude, lng: fromLocation.longitude }]
        : []),
      ...(toLocation ? [{ lat: toLocation.latitude, lng: toLocation.longitude }] : []),
      ...extraMarkers.map((marker) => toMapLatLng(marker.position)),
    ];
    return pts;
  }, [fromLocation, toLocation, extraMarkers]);

  const fitPointsKey = useMemo(
    () => fitPoints.map((p) => `${p.lat},${p.lng}`).join("|"),
    [fitPoints]
  );

  return (
    <div className="route-map-editor">
      {pickMode && (
        <div className={`route-map-banner banner-${pickMode}`}>
          {pickMode === "from"
            ? "اضغط على الخريطة لتحديد نقطة البداية"
            : "اضغط على الخريطة لتحديد نقطة النهاية"}
        </div>
      )}

      <Map
        {...getGoogleMapProps()}
        className="route-map-canvas google-map-canvas"
        defaultCenter={toMapLatLng(DEFAULT_MAP_CENTER)}
        defaultZoom={DEFAULT_MAP_ZOOM}
        onClick={(event) => {
          if (!pickMode) return;
          const latLng = event.detail.latLng;
          if (!latLng) return;
          onMapPick(latLng.lat, latLng.lng);
        }}
      >
        <GoogleMapFitBounds points={fitPoints} pointsKey={fitPointsKey} />

        {roadPolyline && roadPolyline.length > 1 && (
          <Polyline
            path={toMapLatLngList(roadPolyline)}
            strokeColor={ROUTE_LINE.color}
            strokeWeight={ROUTE_LINE.weight}
            strokeOpacity={ROUTE_LINE.opacity}
          />
        )}

        {fromLocation && (
          <AdvancedMarker
            position={{
              lat: fromLocation.latitude,
              lng: fromLocation.longitude,
            }}
            draggable
            title={`من: ${fromLocation.address}`}
            onDragEnd={(event) => {
              const lat = event.latLng?.lat();
              const lng = event.latLng?.lng();
              if (lat == null || lng == null) return;
              onMarkerDrag("from", lat, lng);
            }}
          >
            <span className="endpoint-pin endpoint-pin-from" />
          </AdvancedMarker>
        )}

        {toLocation && (
          <AdvancedMarker
            position={{
              lat: toLocation.latitude,
              lng: toLocation.longitude,
            }}
            draggable
            title={`إلى: ${toLocation.address}`}
            onDragEnd={(event) => {
              const lat = event.latLng?.lat();
              const lng = event.latLng?.lng();
              if (lat == null || lng == null) return;
              onMarkerDrag("to", lat, lng);
            }}
          >
            <span className="endpoint-pin endpoint-pin-to" />
          </AdvancedMarker>
        )}

        {extraMarkers.map((marker) => (
          <AdvancedMarker
            key={marker.id}
            position={toMapLatLng(marker.position)}
            title={marker.label}
          >
            <span className="stop-pin" />
          </AdvancedMarker>
        ))}
      </Map>
    </div>
  );
}

export default function RouteMapEditorGoogle(props: RouteMapEditorGoogleProps) {
  return <RouteMapEditorGoogleMap {...props} />;
}
