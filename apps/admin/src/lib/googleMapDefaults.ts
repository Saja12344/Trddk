import type { MapProps } from "@vis.gl/react-google-maps";
import { getGoogleMapsClientConfig } from "@/lib/googleMapsConfig";

/**
 * Admin Google Map — cloud mapId carries the approved TRDDK dark style
 * (6637bbb701c0f4712d80b34b on 60c310628a438a911067393f, project trddk-54c45).
 * Do not pass client JSON `styles` alongside mapId.
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
