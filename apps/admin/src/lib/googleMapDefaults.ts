import type { MapProps } from "@vis.gl/react-google-maps";
import { getGoogleMapsClientConfig } from "@/lib/googleMapsConfig";

/**
 * Shared Google Map options for admin.
 * Uses cloud Map ID styling (TRDDK dark style on map ID 60c310628a438a911067393f).
 * Do not set client JSON `styles` when mapId is present — they are mutually exclusive.
 * Default vector rendering is required; RASTER ignores cloud styles.
 */
export function getGoogleMapProps(): Partial<MapProps> {
  const { mapId } = getGoogleMapsClientConfig();
  return {
    mapId,
    gestureHandling: "greedy",
    disableDefaultUI: true,
    clickableIcons: false,
    backgroundColor: "#12144A",
  };
}
