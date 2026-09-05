import type { MapProps } from "@vis.gl/react-google-maps";

/**
 * Shared Google Map options.
 * Vector rendering (default) is required for cloud Map ID styling (TRDDK dark style
 * `6637bbb701c0f4712d80b34b` on map ID `60c310628a438a911067393f` in trddk-54c45).
 * RASTER tiles ignore cloud-based styles and show the default white basemap.
 */
export const GOOGLE_MAP_BASE_PROPS = {
  gestureHandling: "greedy",
  disableDefaultUI: true,
  clickableIcons: false,
  backgroundColor: "#12144A",
} satisfies Partial<MapProps>;
