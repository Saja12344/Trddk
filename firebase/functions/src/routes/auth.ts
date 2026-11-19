import { Router, type Response } from "express";
import { COLLECTIONS, normalizePhone } from "@tardadi/shared";
import { db } from "../firebase";
import { getJwtSecret, signJwt, verifyPassword } from "../auth/crypto";
import { consumeRateLimit } from "../auth/rateLimit";
import {
  clientRateKey,
  DRIVER_LOGIN_DENIED,
  driverLoginDecision,
} from "../auth/driverAccess";
import {
  driverReviewLoginDecision,
  driverReviewSession,
} from "../services/driverReview";
import {
  reviewLoginDecision,
  signPassengerReviewToken,
} from "../services/passengerReview";
import { fail, getOrgId, ok } from "../utils";

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

function failAuth(res: Response, error: unknown, fallbackStatus = 401): void {
  const message = (error as Error).message || "";
  if (/محاولات كثيرة/.test(message)) {
    fail(res, message, 429);
    return;
  }
  if (failDriverLookup(res, error)) return;
  fail(res, message, fallbackStatus);
}

function loginRateAllowed(res: Response, scope: string, reqKey: string): boolean {
  const rate = consumeRateLimit(`${scope}:${reqKey}`, 30, 15 * 60 * 1000);
  if (rate.allowed) return true;
  fail(res, "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", 429);
  return false;
}

function failDriverLookup(res: Response, error: unknown): boolean {
  const message = (error as Error).message || "";
  if (/not registered/i.test(message)) {
    fail(res, "رقم الجوال غير مسجل. تواصل مع الإدارة.", 401);
    return true;
  }
  if (/inactive/i.test(message)) {
    fail(res, "حساب السائق غير نشط. تواصل مع الإدارة.", 403);
    return true;
  }
  if (/not assigned/i.test(message)) {
    fail(res, "لم يتم تعيين خط أو باص لك بعد. تواصل مع الإدارة.", 403);
    return true;
  }
  return false;
}

router.post("/driver-start-login", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { phone } = req.body as { phone?: string };

    if (!phone?.trim()) {
      fail(res, "اكتب رقم الجوال.");
      return;
    }
    if (!loginRateAllowed(res, "driver-start", clientRateKey(req))) return;

    const { sendDriverPhoneOtp } = await import("../services/driverOtp");
    await sendDriverPhoneOtp(orgId, phone);
    ok(res, { sent: true });
  } catch (error) {
    const message = (error as Error).message || "";
    if (/محاولات كثيرة/.test(message)) {
      fail(res, message, 429);
      return;
    }
    if (/اكتب رقم الجوال/.test(message) || /تعذّر إرسال رمز التحقق/.test(message)) {
      fail(res, message, 400);
      return;
    }
    ok(res, { sent: true });
  }
});

router.post("/driver-verify-otp", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { phone, code } = req.body as { phone?: string; code?: string };

    if (!phone?.trim() || !code?.trim()) {
      fail(res, "أدخل رقم الجوال ورمز التحقق.");
      return;
    }

    const { verifyDriverPhoneOtp } = await import("../services/driverOtp");
    const session = await verifyDriverPhoneOtp(orgId, phone, code);
    ok(res, session);
  } catch (error) {
    failAuth(res, error);
  }
});

router.post("/driver-login", async (req, res) => {
  try {
    if (!loginRateAllowed(res, "driver-login", clientRateKey(req))) return;
    const { idToken } = req.body as { idToken?: string };
    const decision = driverLoginDecision(idToken);
    if (!decision.ok) {
      fail(res, DRIVER_LOGIN_DENIED, 401);
      return;
    }

    const { createFirebaseAppSession } = await import(
      "../services/firebaseAppSession"
    );
    const session = await createFirebaseAppSession(decision.idToken, "driver");
    ok(res, session);
  } catch (error) {
    failAuth(res, error);
  }
});

router.post("/driver-review-login", async (req, res) => {
  try {
    const phone = String(req.body?.phone ?? "");
    const code = String(req.body?.code ?? "");
    const normalized = normalizePhone(phone);
    const rate = consumeRateLimit(
      `driver-review:${normalized || "invalid"}`,
      12,
      15 * 60 * 1000
    );
    if (!rate.allowed) {
      fail(res, "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", 429);
      return;
    }

    const decision = driverReviewLoginDecision(phone, code);
    if (!decision.ok) {
      fail(res, "رمز التحقق غير صحيح.", 401);
      return;
    }

    ok(res, driverReviewSession(decision.phone));
  } catch (error) {
    fail(res, (error as Error).message, 400);
  }
});

router.post("/passenger-review-login", async (req, res) => {
  try {
    const phone = String(req.body?.phone ?? "");
    const code = String(req.body?.code ?? "");
    const normalized = normalizePhone(phone);
    const rate = consumeRateLimit(
      `passenger-review:${normalized || "invalid"}`,
      12,
      15 * 60 * 1000
    );
    if (!rate.allowed) {
      fail(res, "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", 429);
      return;
    }

    const decision = reviewLoginDecision(phone, code);
    if (!decision.ok) {
      fail(res, "رمز التحقق غير صحيح.", 401);
      return;
    }

    ok(res, {
      sessionToken: signPassengerReviewToken(decision.phone),
      scope: "public",
      role: "passenger_review",
      businessId: null,
    });
  } catch (error) {
    fail(res, (error as Error).message, 400);
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
    if (!loginRateAllowed(res, "firebase-app-session", clientRateKey(req))) return;
    const { createFirebaseAppSession } = await import(
      "../services/firebaseAppSession"
    );
    const session = await createFirebaseAppSession(idToken, app);
    ok(res, session);
  } catch (error) {
    failAuth(res, error);
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

router.post("/passenger-start-phone-login", async (req, res) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone?.trim()) {
      fail(res, "اكتب رقم الجوال.");
      return;
    }
    if (!loginRateAllowed(res, "passenger-start-phone", clientRateKey(req))) return;
    const { sendPassengerPhoneOtp } = await import("../services/passengerPhoneOtp");
    await sendPassengerPhoneOtp(phone);
    ok(res, { sent: true });
  } catch (error) {
    const message = (error as Error).message || "";
    if (/محاولات كثيرة/.test(message)) {
      fail(res, message, 429);
      return;
    }
    if (/اكتب رقم الجوال/.test(message) || /تعذّر إرسال رمز التحقق/.test(message)) {
      fail(res, message, 400);
      return;
    }
    ok(res, { sent: true });
  }
});

router.post("/passenger-verify-phone-otp", async (req, res) => {
  try {
    const { phone, code } = req.body as { phone?: string; code?: string };
    if (!phone?.trim() || !code?.trim()) {
      fail(res, "أدخل رقم الجوال ورمز التحقق.");
      return;
    }
    if (!loginRateAllowed(res, "passenger-verify-phone", clientRateKey(req))) return;
    const { verifyPassengerPhoneOtp } = await import("../services/passengerPhoneOtp");
    ok(res, await verifyPassengerPhoneOtp(phone, code));
  } catch (error) {
    const message = (error as Error).message || "";
    const status = /محاولات كثيرة/.test(message) ? 429 : 401;
    fail(res, message, status);
  }
});

router.post("/passenger-phone-login", async (req, res) => {
  try {
    if (!loginRateAllowed(res, "passenger-phone-login", clientRateKey(req))) return;
    const { idToken } = req.body as { idToken?: string };
    if (!idToken?.trim()) {
      fail(res, "Invalid request.", 401);
      return;
    }
    const { verifyFirebaseIdToken } = await import("../auth/firebaseAuth");
    const decoded = await verifyFirebaseIdToken(idToken);
    const phone = decoded?.phone_number;
    if (!decoded?.uid || !phone) {
      fail(res, "Phone number is not registered. Contact your employer.", 401);
      return;
    }
    const { listPassengerMembershipsByPhone } = await import("../services/passengerSession");
    const result = await listPassengerMembershipsByPhone(decoded.uid, phone);
    ok(res, result);
  } catch (error) {
    failAuth(res, error);
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
      businessId,
      parsed.phone
    );
    ok(res, {
      sessionToken,
      businessId,
      businessName: (businessDoc.data()?.name as string) ?? businessId,
      email: parsed.email,
      phone: parsed.phone,
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

router.post("/driver-delete-account", async (req, res) => {
  try {
    if (!loginRateAllowed(res, "driver-delete", clientRateKey(req))) return;
    const { bearerToken, parseDriverSessionToken } = await import(
      "../auth/driverAccess"
    );
    const { isReviewDriverIdentity } = await import(
      "../services/accountDeletion"
    );
    const token = bearerToken(req);
    const session = token ? parseDriverSessionToken(token) : null;
    if (!session) {
      fail(res, "يجب تسجيل الدخول.", 401);
      return;
    }
    if (isReviewDriverIdentity(session.driverId, session.businessId)) {
      ok(res, { deleted: false, review: true });
      return;
    }
    const { deleteDriverAccount } = await import(
      "../services/accountDeletionRun"
    );
    ok(res, await deleteDriverAccount(session.driverId, session.businessId));
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.post("/passenger-delete-account", async (req, res) => {
  try {
    if (!loginRateAllowed(res, "passenger-delete", clientRateKey(req))) return;
    const { requestIsPassengerReview } = await import(
      "../services/passengerReview"
    );
    if (requestIsPassengerReview(req)) {
      ok(res, { deleted: false, review: true });
      return;
    }
    const { bearerToken } = await import("../auth/driverAccess");
    const { parsePassengerSessionToken } = await import(
      "../services/passengerSession"
    );
    const { isReviewPassengerIdentity } = await import(
      "../services/accountDeletion"
    );
    const token = bearerToken(req);
    const session = token ? parsePassengerSessionToken(token) : null;
    if (!session?.sub) {
      fail(res, "يجب تسجيل الدخول.", 401);
      return;
    }
    if (isReviewPassengerIdentity(session.sub, session.phone)) {
      ok(res, { deleted: false, review: true });
      return;
    }
    const { deletePassengerAccount } = await import(
      "../services/accountDeletionRun"
    );
    ok(
      res,
      await deletePassengerAccount(session.sub, session.businessId)
    );
  } catch (error) {
    fail(res, (error as Error).message, 500);
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
