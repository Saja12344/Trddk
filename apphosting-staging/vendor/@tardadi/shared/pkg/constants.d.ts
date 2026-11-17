export declare const BRAND: {
    readonly orange: "#FF6B00";
    readonly navy: "#1A2744";
    readonly white: "#FFFFFF";
    readonly grey: "#9CA3AF";
};
export declare const GPS_INTERVAL_MS: {
    readonly moving: 5000;
    readonly idle: 30000;
};
export declare const GEOFENCE_MAX_DISTANCE_M = 500;
export declare const DEFAULT_REMINDER_MINUTES = 5;
export declare const COLLECTIONS: {
    /** Primary tenant collection — each doc is a Business workspace. */
    readonly businesses: "businesses";
    /** @deprecated Alias for businesses — used during migration. */
    readonly organizations: "businesses";
    readonly adminUsers: "admin_users";
    /** Firebase Auth user profiles (primary auth store). */
    readonly users: "users";
    readonly memberships: "memberships";
    readonly drivers: "drivers";
    readonly buses: "buses";
    readonly routes: "routes";
    readonly stops: "stops";
    readonly trips: "trips";
    readonly gpsLogs: "gps_logs";
    readonly reminders: "reminders";
    readonly passengerOtp: "passenger_otp";
    readonly adminOtp: "admin_otp";
    readonly adminMfaChallenges: "admin_mfa_challenges";
};
export declare function businessPath(businessId: string): string;
export declare function businessSubcollection(businessId: string, subcollection: string): string;
/** @deprecated Use businessPath */
export declare function orgPath(organizationId: string): string;
/** @deprecated Use businessSubcollection */
export declare function orgSubcollection(organizationId: string, subcollection: string): string;
