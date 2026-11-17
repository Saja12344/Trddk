"use client";

import dynamic from "next/dynamic";
import type { LatLngExpression } from "leaflet";
import type { LocationPlace } from "@tardadi/shared";
import type { MapMarker } from "@/lib/mapUtils";
import GoogleMapsShell from "@/components/maps/GoogleMapsShell";
import { isGoogleMapsEnabled } from "@/lib/googleMapsConfig";
import type { PickMode } from "./RouteMapEditorInner";

const loading = (
  <div className="route-map-editor route-map-loading">جاري تحميل الخريطة...</div>
);

const LeafletRouteMapEditor = dynamic(() => import("./RouteMapEditorInner"), {
  ssr: false,
  loading: () => loading,
});

const GoogleRouteMapEditor = dynamic(() => import("./RouteMapEditorGoogle"), {
  ssr: false,
  loading: () => loading,
});

type RouteMapEditorProps = {
  fromLocation: LocationPlace | null;
  toLocation: LocationPlace | null;
  pickMode: PickMode;
  roadPolyline?: LatLngExpression[];
  extraMarkers?: MapMarker[];
  onMapPick: (lat: number, lng: number) => void;
  onMarkerDrag: (kind: "from" | "to", lat: number, lng: number) => void;
};

export default function RouteMapEditor(props: RouteMapEditorProps) {
  if (!isGoogleMapsEnabled()) {
    return <LeafletRouteMapEditor {...props} />;
  }

  return (
    <GoogleMapsShell fallback={<LeafletRouteMapEditor {...props} />}>
      <GoogleRouteMapEditor {...props} />
    </GoogleMapsShell>
  );
}

export type { PickMode };
