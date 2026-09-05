import type { MapProps } from "@vis.gl/react-google-maps";
import { TRDDK_DARK_MAP_STYLE } from "@/lib/trddkMapStyle";

/**
 * Shared Google Map options for admin.
 * Uses approved client JSON styling (darkNavyJson) — do not pass mapId here;
 * cloud mapId and the styles prop are mutually exclusive in the Maps JS API.
 */
export const GOOGLE_MAP_BASE_PROPS = {
  gestureHandling: "greedy",
  disableDefaultUI: true,
  clickableIcons: false,
  backgroundColor: "#12144A",
  styles: TRDDK_DARK_MAP_STYLE,
} satisfies Partial<MapProps>;
