/**
 * Official store destinations for TRDDK mobile apps.
 *
 * Replace `url` with the live App Store / Google Play listing after publication.
 * Leave `url` null to render a non-clickable "coming soon" state — never point
 * at developer-account or placeholder pages.
 */
export type StorePlatform = "ios" | "android";

export type StoreDestination = {
  url: string | null;
  /** Bundle / package id once assigned by the stores — not used as a link. */
  storeId: string | null;
};

export type DistributedApp = "passenger" | "driver";

export const appDistribution: Record<
  DistributedApp,
  Record<StorePlatform, StoreDestination>
> = {
  passenger: {
    ios: { url: null, storeId: null },
    android: {
      url: "https://play.google.com/store/apps/details?id=com.tardadi.tardadi_passenger",
      storeId: "com.tardadi.tardadi_passenger",
    },
  },
  driver: {
    ios: { url: null, storeId: null },
    android: {
      url: "https://play.google.com/store/apps/details?id=com.tardadi.tardadi_driver",
      storeId: "com.tardadi.tardadi_driver",
    },
  },
};

export function storeIsLive(destination: StoreDestination): destination is StoreDestination & {
  url: string;
} {
  return Boolean(destination.url);
}
