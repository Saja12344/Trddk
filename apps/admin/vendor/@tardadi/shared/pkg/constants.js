"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIONS = exports.DEFAULT_REMINDER_MINUTES = exports.GEOFENCE_MAX_DISTANCE_M = exports.GPS_INTERVAL_MS = exports.BRAND = void 0;
exports.businessPath = businessPath;
exports.businessSubcollection = businessSubcollection;
exports.orgPath = orgPath;
exports.orgSubcollection = orgSubcollection;
exports.BRAND = {
    orange: "#FF6B00",
    navy: "#1A2744",
    white: "#FFFFFF",
    grey: "#9CA3AF",
};
exports.GPS_INTERVAL_MS = {
    moving: 5000,
    idle: 30000,
};
exports.GEOFENCE_MAX_DISTANCE_M = 500;
exports.DEFAULT_REMINDER_MINUTES = 5;
exports.COLLECTIONS = {
    /** Primary tenant collection — each doc is a Business workspace. */
    businesses: "businesses",
    /** @deprecated Alias for businesses — used during migration. */
    organizations: "businesses",
    adminUsers: "admin_users",
    /** Firebase Auth user profiles (primary auth store). */
    users: "users",
    memberships: "memberships",
    drivers: "drivers",
    buses: "buses",
    routes: "routes",
    stops: "stops",
    trips: "trips",
    gpsLogs: "gps_logs",
    reminders: "reminders",
    passengerOtp: "passenger_otp",
    driverOtp: "driver_otp",
    adminOtp: "admin_otp",
    adminMfaChallenges: "admin_mfa_challenges",
};
function businessPath(businessId) {
    return `${exports.COLLECTIONS.businesses}/${businessId}`;
}
function businessSubcollection(businessId, subcollection) {
    return `${businessPath(businessId)}/${subcollection}`;
}
/** @deprecated Use businessPath */
function orgPath(organizationId) {
    return businessPath(organizationId);
}
/** @deprecated Use businessSubcollection */
function orgSubcollection(organizationId, subcollection) {
    return businessSubcollection(organizationId, subcollection);
}
