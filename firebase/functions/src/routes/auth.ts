import { Router } from "express";
import { COLLECTIONS, normalizePhone } from "@tardadi/shared";
import type { Driver, Bus, Route, Stop } from "@tardadi/shared";
import { db } from "../firebase";
import { getJwtSecret, signJwt, verifyPassword } from "../auth/crypto";
import { fail, getOrgId, ok } from "../utils";
import { withBusinessId } from "../auth/scope";

const router = Router();

router.post("/admin-login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      fail(res, "اكتب رقم الجوال وكلمة المرور.");
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    const snapshot = await db
      .collection(COLLECTIONS.adminUsers)
      .where("phone", "==", normalizedPhone)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      fail(res, "رقم الجوال أو كلمة المرور غير صحيحة.", 401);
      return;
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (!verifyPassword(password, userData.passwordHash as string)) {
      fail(res, "رقم الجوال أو كلمة المرور غير صحيحة.", 401);
      return;
    }

    if (userData.role === "business_admin" && userData.businessId) {
      const businessDoc = await db
        .collection(COLLECTIONS.businesses)
        .doc(userData.businessId as string)
        .get();
      if (!businessDoc.exists || businessDoc.data()?.status !== "active") {
        fail(res, "شركتك معطّلة. تواصل مع مدير النظام.", 403);
        return;
      }
    }

    const user = {
      userId: userDoc.id,
      name: userData.name as string,
      phone: userData.phone as string,
      role: userData.role as "super_admin" | "business_admin",
      businessId: (userData.businessId as string | null) ?? null,
    };

    const token = signJwt(
      {
        sub: user.userId,
        role: user.role,
        businessId: user.businessId,
        name: user.name,
        phone: user.phone,
      },
      getJwtSecret()
    );

    ok(res, { token, user });
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.post("/driver-login", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const businessId = orgId;
    const { phone } = req.body;

    if (!phone) {
      fail(res, "phone is required");
      return;
    }

    const normalizedPhone = normalizePhone(phone);

    const driversSnapshot = await db
      .collection(COLLECTIONS.organizations)
      .doc(orgId)
      .collection(COLLECTIONS.drivers)
      .where("phone", "==", normalizedPhone)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (driversSnapshot.empty) {
      fail(res, "رقم الجوال غير مسجل. تواصل مع الإدارة.", 401);
      return;
    }

    const driverDoc = driversSnapshot.docs[0];
    const driverData = driverDoc.data();
    const driver: Driver = withBusinessId(businessId, {
      driverId: driverDoc.id,
      name: driverData.name,
      phone: driverData.phone,
      driverCode: driverData.driverCode,
      assignedRouteId: driverData.assignedRouteId,
      assignedBusId: driverData.assignedBusId,
      status: driverData.status,
    }) as Driver;

    if (!driver.assignedRouteId || !driver.assignedBusId) {
      fail(res, "لم يتم تعيين خط أو باص لك بعد. تواصل مع الإدارة.", 403);
      return;
    }

    const busDoc = await db
      .collection(COLLECTIONS.organizations)
      .doc(orgId)
      .collection(COLLECTIONS.buses)
      .doc(driver.assignedBusId)
      .get();

    if (!busDoc.exists) {
      fail(res, "الباص المعيّن غير موجود", 404);
      return;
    }

    const bus: Bus = withBusinessId(businessId, {
      busId: busDoc.id,
      ...(busDoc.data() as Omit<Bus, "busId" | "businessId" | "organizationId">),
    }) as Bus;

    const routeDoc = await db
      .collection(COLLECTIONS.organizations)
      .doc(orgId)
      .collection(COLLECTIONS.routes)
      .doc(driver.assignedRouteId)
      .get();

    if (!routeDoc.exists) {
      fail(res, "الخط المعيّن غير موجود", 404);
      return;
    }

    const route: Route = withBusinessId(businessId, {
      routeId: routeDoc.id,
      ...(routeDoc.data() as Omit<Route, "routeId" | "businessId" | "organizationId">),
    }) as Route;

    const stopsSnapshot = await routeDoc.ref
      .collection(COLLECTIONS.stops)
      .orderBy("sequenceNo")
      .get();

    const stops: Stop[] = stopsSnapshot.docs.map((doc) => ({
      stopId: doc.id,
      routeId: route.routeId,
      ...(doc.data() as Omit<Stop, "stopId" | "routeId">),
    }));

    const activeTripSnapshot = await db
      .collection(COLLECTIONS.organizations)
      .doc(orgId)
      .collection(COLLECTIONS.trips)
      .where("busId", "==", driver.assignedBusId)
      .where("tripStatus", "==", "active")
      .limit(1)
      .get();

    const tripId = activeTripSnapshot.empty
      ? null
      : activeTripSnapshot.docs[0].id;

    ok(res, { driver, bus, route, stops, tripId });
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.post("/passenger-send-otp", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.trim()) {
      fail(res, "Enter a valid email address.");
      return;
    }
    const { sendPassengerEmailOtp } = await import("../services/passengerOtp");
    const result = await sendPassengerEmailOtp(email);
    ok(res, { sent: true, throttled: result.throttled });
  } catch (error) {
    fail(res, (error as Error).message, 400);
  }
});

router.post("/passenger-verify-otp", async (req, res) => {
  try {
    const { email, code, purpose } = req.body as {
      email?: string;
      code?: string;
      purpose?: string;
    };
    if (!email?.trim() || !code?.trim()) {
      fail(res, "Enter the 6-digit code.");
      return;
    }
    const { verifyPassengerEmailOtp } = await import("../services/passengerOtp");
    const result = await verifyPassengerEmailOtp(email, code, {
      requireBusinessMembership: purpose === "business",
    });
    ok(res, result);
  } catch (error) {
    fail(res, (error as Error).message, 401);
  }
});

router.post("/app-login-hint", async (req, res) => {
  try {
    const { email, app } = req.body as {
      email?: string;
      app?: "driver" | "passenger" | "admin";
    };
    if (!email?.trim() || !app) {
      fail(res, "Invalid request.");
      return;
    }
    const { resolveAppLoginHint } = await import("../services/users");
    const result = await resolveAppLoginHint(email, app);
    ok(res, result);
  } catch (error) {
    fail(res, (error as Error).message, 401);
  }
});

router.post("/firebase-app-session", async (req, res) => {
  try {
    const { idToken, app } = req.body as {
      idToken?: string;
      app?: "driver" | "passenger";
    };
    if (!idToken?.trim() || !app) {
      fail(res, "Invalid request.");
      return;
    }
    const { createFirebaseAppSession } = await import(
      "../services/firebaseAppSession"
    );
    const session = await createFirebaseAppSession(idToken, app);
    ok(res, session);
  } catch (error) {
    fail(res, (error as Error).message, 401);
  }
});

router.post("/app-send-password-setup", async (req, res) => {
  try {
    const { email, app } = req.body as {
      email?: string;
      app?: "driver" | "passenger" | "admin";
    };
    if (!email?.trim() || !app) {
      fail(res, "Invalid request.");
      return;
    }
    const { resolveAppLoginHint, sendPasswordSetupLink } = await import(
      "../services/users"
    );
    await resolveAppLoginHint(email, app);
    await sendPasswordSetupLink(email);
    ok(res, { sent: true });
  } catch (error) {
    fail(res, (error as Error).message, 400);
  }
});

router.post("/passenger-business-session", async (req, res) => {
  try {
    const { verificationToken, businessId } = req.body as {
      verificationToken?: string;
      businessId?: string;
    };
    if (!verificationToken || !businessId) {
      fail(res, "Invalid request.");
      return;
    }
    const {
      parsePassengerVerificationToken,
      assertPassengerBusinessAccess,
      signPassengerSessionToken,
    } = await import("../services/passengerSession");
    const parsed = parsePassengerVerificationToken(verificationToken);
    if (!parsed) {
      fail(res, "Session expired. Sign in again.", 401);
      return;
    }
    await assertPassengerBusinessAccess(parsed.uid, businessId);
    const businessDoc = await db.collection(COLLECTIONS.businesses).doc(businessId).get();
    if (!businessDoc.exists) {
      fail(res, "Company not found.", 404);
      return;
    }
    const sessionToken = signPassengerSessionToken(
      parsed.uid,
      parsed.email,
      businessId
    );
    ok(res, {
      sessionToken,
      businessId,
      businessName: (businessDoc.data()?.name as string) ?? businessId,
      email: parsed.email,
    });
  } catch (error) {
    fail(res, (error as Error).message, 401);
  }
});

router.post("/admin-mfa-challenge", async (req, res) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      fail(res, "Invalid credentials.");
      return;
    }
    const { beginAdminMfaChallenge } = await import("../services/adminMfa");
    const result = await beginAdminMfaChallenge(idToken);
    ok(res, result);
  } catch (error) {
    fail(res, (error as Error).message, 401);
  }
});

router.post("/admin-mfa-verify", async (req, res) => {
  try {
    const { challengeToken, code } = req.body as {
      challengeToken?: string;
      code?: string;
    };
    if (!challengeToken || !code?.trim()) {
      fail(res, "Invalid request.");
      return;
    }
    const { verifyAdminEmailOtp } = await import("../services/adminMfa");
    const result = await verifyAdminEmailOtp(challengeToken, code);
    ok(res, result);
  } catch (error) {
    fail(res, (error as Error).message, 401);
  }
});

router.post("/admin-mfa-resend", async (req, res) => {
  try {
    const { challengeToken } = req.body as { challengeToken?: string };
    if (!challengeToken) {
      fail(res, "Invalid request.");
      return;
    }
    const { resendAdminMfaOtp } = await import("../services/adminMfa");
    await resendAdminMfaOtp(challengeToken);
    ok(res, { sent: true });
  } catch (error) {
    fail(res, (error as Error).message, 400);
  }
});

export default router;
