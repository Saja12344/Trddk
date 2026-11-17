import { RenderingType, type MapProps } from "@vis.gl/react-google-maps";

/** Shared Google Map options — raster avoids WebGL vector fallback warnings. */
export const GOOGLE_MAP_BASE_PROPS = {
  gestureHandling: "greedy",
  disableDefaultUI: true,
  clickableIcons: false,
  renderingType: RenderingType.RASTER,
} satisfies Partial<MapProps>;
