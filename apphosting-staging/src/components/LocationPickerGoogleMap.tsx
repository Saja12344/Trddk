"use client";

import { useEffect, type ReactNode } from "react";
import { AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import type { LocationPlace } from "@tardadi/shared";
import GoogleMapsShell from "@/components/maps/GoogleMapsShell";
import type { MapLatLng } from "@/components/maps/googleMapUtils";
import { toMapLatLng } from "@/components/maps/googleMapUtils";
import { getGoogleMapsClientConfig } from "@/lib/googleMapsConfig";
import { GOOGLE_MAP_BASE_PROPS } from "@/lib/googleMapDefaults";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/mapUtils";

function GoogleMapFlyTo({
  position,
  zoom,
}: {
  position: MapLatLng;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(position);
    const nextZoom = Math.max(map.getZoom() ?? zoom, zoom);
    map.setZoom(nextZoom);
  }, [map, position, zoom]);

  return null;
}

type LocationPickerGoogleMapProps = {
  pinColor: string;
  value: LocationPlace | null;
  onPick: (lat: number, lng: number) => void;
  onDrag: (lat: number, lng: number) => void;
};

function LocationPickerGoogleMap({
  pinColor,
  value,
  onPick,
  onDrag,
}: LocationPickerGoogleMapProps) {
  const { mapId } = getGoogleMapsClientConfig();
  const center = value
    ? { lat: value.latitude, lng: value.longitude }
    : toMapLatLng(DEFAULT_MAP_CENTER);

  return (
    <Map
      {...GOOGLE_MAP_BASE_PROPS}
      mapId={mapId}
      className="google-map-canvas"
      style={{ height: 220, width: "100%", borderRadius: 12 }}
      defaultCenter={center}
      defaultZoom={value ? 14 : DEFAULT_MAP_ZOOM}
      onClick={(event) => {
        const latLng = event.detail.latLng;
        if (!latLng) return;
        onPick(latLng.lat, latLng.lng);
      }}
    >
      {value && (
        <>
          <GoogleMapFlyTo position={center} zoom={14} />
          <AdvancedMarker
            position={center}
            draggable
            onDragEnd={(event) => {
              const lat = event.latLng?.lat();
              const lng = event.latLng?.lng();
              if (lat == null || lng == null) return;
              onDrag(lat, lng);
            }}
          >
            <span
              className="location-pin"
              style={{ ["--pin-color" as string]: pinColor }}
            />
          </AdvancedMarker>
        </>
      )}
    </Map>
  );
}

export default function LocationPickerGoogleMapShell(
  props: LocationPickerGoogleMapProps & { fallback: ReactNode }
) {
  const { fallback, ...mapProps } = props;
  return (
    <GoogleMapsShell fallback={fallback}>
      <LocationPickerGoogleMap {...mapProps} />
    </GoogleMapsShell>
  );
}
