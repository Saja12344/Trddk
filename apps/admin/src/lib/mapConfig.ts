/** OSM tiles with dark styling applied in CSS (see globals.css .map-container). */
export const MAP_TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  subdomains: "abc",
} as const;

export const ROUTE_LINE = {
  color: "#EB4F26",
  weight: 5,
  opacity: 0.92,
} as const;
