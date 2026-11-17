/** Client-side Google Maps display — opt-in after Maps JavaScript API is enabled in GCP. */
export function isGoogleMapsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_DISPLAY === "true" &&
    Boolean(
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() &&
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim()
    )
  );
}

export function getGoogleMapsClientConfig(): {
  apiKey: string;
  mapId: string;
} {
  return {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!.trim(),
    mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID!.trim(),
  };
}
