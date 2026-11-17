"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TardadiApiClient = void 0;
const ERROR_MESSAGES = [
    [
        /backend unreachable|failed to fetch|networkerror|load failed|fetch failed/i,
        "تعذّر الاتصال بالخادم. تأكد أن الباكند شغال ثم حدّث الصفحة.",
    ],
    [/forbidden resource/i, "ليس لديك صلاحية للوصول لهذا الطلب."],
    [/request failed|internal|server error/i, "صار خطأ في الخادم. حاول مرة أخرى."],
    [/driver not found/i, "لم نجد هذا السائق."],
    [/route not found/i, "لم نجد هذا الخط."],
    [/trip not found/i, "لم نجد هذه الرحلة."],
    [/phone is required/i, "اكتب رقم الجوال."],
    [/name and phone are required/i, "اكتب اسم السائق ورقم جواله."],
    [/plateNo and label are required/i, "اكتب رقم اللوحة واسم الباص."],
    [/name and code are required/i, "اكتب اسم الخط وكوده."],
    [/fromLocation .* required/i, "حدّد نقطة بداية الخط."],
    [/toLocation .* required/i, "حدّد نقطة نهاية الخط."],
    [/driverId, busId, and routeId are required/i, "اختر السائق والباص والخط قبل بدء الرحلة."],
    [/tripId and driverId are required/i, "بيانات إنهاء الرحلة غير مكتملة."],
    [/tripId, driverId, busId, latitude, and longitude are required/i, "بيانات موقع الباص غير مكتملة."],
];
function toUserMessage(message) {
    for (const [pattern, userMessage] of ERROR_MESSAGES) {
        if (pattern.test(message))
            return userMessage;
    }
    return message || "صار خطأ غير متوقع. حاول مرة أخرى.";
}
class TardadiApiClient {
    constructor(baseUrl, organizationId) {
        this.baseUrl = baseUrl;
        this.organizationId = organizationId;
    }
    buildUrl(path, extraQuery) {
        const base = this.baseUrl.replace(/\/$/, "");
        const [pathname, search = ""] = path.split("?");
        const params = new URLSearchParams(search);
        params.set("organizationId", this.organizationId);
        if (extraQuery) {
            for (const [key, value] of Object.entries(extraQuery)) {
                params.set(key, value);
            }
        }
        return `${base}${pathname}?${params.toString()}`;
    }
    async request(path, options = {}, extraQuery) {
        let response;
        try {
            response = await fetch(this.buildUrl(path, extraQuery), {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });
        }
        catch (error) {
            throw new Error(toUserMessage(error.message));
        }
        const body = (await response.json().catch(() => ({
            success: false,
            error: `Request failed: ${response.status}`,
        })));
        if (!body.success || body.data === undefined) {
            throw new Error(toUserMessage(body.error || `Request failed: ${response.status}`));
        }
        return body.data;
    }
    getRoutes() {
        return this.request("/api/routes");
    }
    getRoute(routeId) {
        return this.request(`/api/routes/${routeId}`);
    }
    getBuses(activeOnly = false) {
        return this.request("/api/buses", {}, activeOnly ? { active: "true" } : undefined);
    }
    getDrivers() {
        return this.request("/api/drivers");
    }
    getDriverMe(driverId) {
        return this.request("/api/drivers/me", {}, { driverId });
    }
    driverLogin(phone) {
        return this.request("/api/auth/driver-login", {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.organizationId,
                phone,
            }),
        });
    }
    getTrips(status) {
        return this.request("/api/trips", {}, status ? { status } : undefined);
    }
    startTrip(driverId, busId, routeId) {
        return this.request("/api/trips/start", {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.organizationId,
                driverId,
                busId,
                routeId,
            }),
        });
    }
    endTrip(tripId, driverId) {
        return this.request("/api/trips/end", {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.organizationId,
                tripId,
                driverId,
            }),
        });
    }
    setTripBreak(tripId, driverId, onBreak) {
        return this.request("/api/trips/break", {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.organizationId,
                tripId,
                driverId,
                onBreak,
            }),
        });
    }
    sendGps(payload) {
        return this.request("/api/gps", {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.organizationId,
                ...payload,
            }),
        });
    }
    getReminders(userId) {
        return this.request("/api/reminders", {}, userId ? { userId } : undefined);
    }
    createReminder(payload) {
        return this.request("/api/reminders", {
            method: "POST",
            body: JSON.stringify({
                organizationId: this.organizationId,
                ...payload,
            }),
        });
    }
    cancelReminder(reminderId) {
        return this.request(`/api/reminders/${reminderId}`, {
            method: "DELETE",
        });
    }
}
exports.TardadiApiClient = TardadiApiClient;
