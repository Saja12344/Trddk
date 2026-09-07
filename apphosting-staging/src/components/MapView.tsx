"use client";

import dynamic from "next/dynamic";
import type { LatLngExpression } from "leaflet";
import type { MapMarker } from "@/lib/mapUtils";
import GoogleMapsShell from "@/components/maps/GoogleMapsShell";
import { isGoogleMapsEnabled } from "@/lib/googleMapsConfig";

const loading = (
  <div className="map-loading" style={{ height: 360 }}>
    جاري تحميل الخريطة...
  </div>
);

const LeafletMapView = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => loading,
});

const GoogleMapView = dynamic(() => import("./MapViewGoogle"), {
  ssr: false,
  loading: () => loading,
});

type MapViewProps = {
  markers?: MapMarker[];
  polyline?: LatLngExpression[];
  className?: string;
  height?: number | string;
};

export default function MapView(props: MapViewProps) {
  if (!isGoogleMapsEnabled()) {
    return <LeafletMapView {...props} />;
  }

  return (
    <GoogleMapsShell fallback={<LeafletMapView {...props} />}>
      <GoogleMapView {...props} />
    </GoogleMapsShell>
  );
}
