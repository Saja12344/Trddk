import type { MapProps } from "@vis.gl/react-google-maps";
import { TRDDK_DARK_MAP_STYLE } from "@/lib/trddkMapStyle";

/**
 * Admin Google Map — same darkNavyJson as passenger app
 * (packages/tardadi_core/lib/src/maps/trddk_map_style.dart).
 * Do not pass mapId here; cloud mapId and client `styles` are mutually exclusive.
 */
export function getGoogleMapProps(): Partial<MapProps> {
  return {
    gestureHandling: "greedy",
    disableDefaultUI: true,
    clickableIcons: false,
    backgroundColor: "#12144A",
    styles: TRDDK_DARK_MAP_STYLE,
  };
}
