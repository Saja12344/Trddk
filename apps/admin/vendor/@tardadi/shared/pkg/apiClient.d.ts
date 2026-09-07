export declare class TardadiApiClient {
    private baseUrl;
    private organizationId;
    constructor(baseUrl: string, organizationId: string);
    private buildUrl;
    private request;
    getRoutes(): Promise<unknown>;
    getRoute(routeId: string): Promise<unknown>;
    getBuses(activeOnly?: boolean): Promise<unknown>;
    getDrivers(): Promise<unknown>;
    getDriverMe(driverId: string): Promise<unknown>;
    driverLogin(phone: string): Promise<unknown>;
    getTrips(status?: string): Promise<unknown>;
    startTrip(driverId: string, busId: string, routeId: string): Promise<unknown>;
    endTrip(tripId: string, driverId: string): Promise<unknown>;
    setTripBreak(tripId: string, driverId: string, onBreak: boolean): Promise<unknown>;
    sendGps(payload: {
        tripId: string;
        driverId: string;
        busId: string;
        latitude: number;
        longitude: number;
        speedKmh?: number;
        heading?: number;
    }): Promise<unknown>;
    getReminders(userId?: string): Promise<unknown>;
    createReminder(payload: {
        userId: string;
        busId: string;
        routeId: string;
        stopId: string;
        fcmToken: string;
        notifyWhenMinutesAway?: number;
    }): Promise<unknown>;
    cancelReminder(reminderId: string): Promise<unknown>;
}
