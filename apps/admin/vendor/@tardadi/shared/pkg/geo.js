"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineDistanceM = haversineDistanceM;
exports.isWithinGeofence = isWithinGeofence;
exports.estimateEtaMinutes = estimateEtaMinutes;
const constants_1 = require("./constants");
const EARTH_RADIUS_M = 6371000;
function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}
function haversineDistanceM(a, b) {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLng = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
function isWithinGeofence(point, stops, maxDistanceM = constants_1.GEOFENCE_MAX_DISTANCE_M) {
    if (stops.length === 0) {
        return true;
    }
    return stops.some((stop) => haversineDistanceM(point, stop) <= maxDistanceM);
}
function estimateEtaMinutes(busLocation, stopLocation, speedKmh = 30) {
    const distanceM = haversineDistanceM(busLocation, stopLocation);
    const speedMs = Math.max(speedKmh, 5) / 3.6;
    return Math.ceil(distanceM / speedMs / 60);
}
