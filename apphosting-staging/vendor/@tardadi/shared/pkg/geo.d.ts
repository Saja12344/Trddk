import type { GeoPoint } from "./types";
export declare function haversineDistanceM(a: GeoPoint, b: GeoPoint): number;
export declare function isWithinGeofence(point: GeoPoint, stops: GeoPoint[], maxDistanceM?: number): boolean;
export declare function estimateEtaMinutes(busLocation: GeoPoint, stopLocation: GeoPoint, speedKmh?: number): number;
