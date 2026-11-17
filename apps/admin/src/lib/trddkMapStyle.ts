import type { MapProps } from "@vis.gl/react-google-maps";

/**
 * Approved TRDDK dark navy map style — canonical source:
 * packages/tardadi_core/lib/src/maps/trddk_map_style.dart (darkNavyJson)
 *
 * Admin web uses client JSON styling because mapId cloud styling and the legacy
 * `styles` prop are mutually exclusive; JSON is reliable across browsers.
 */
export const TRDDK_DARK_MAP_STYLE: NonNullable<MapProps["styles"]> = [
  { elementType: "geometry", stylers: [{ color: "#12144a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b8bdd4" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#12144a" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#24277a" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8b93b8" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1a1f5c" }],
  },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2f3768" }] },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#434d85" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3d4788" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#5a6499" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9aa3c7" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#24277a" }],
  },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1133" }] },
];
