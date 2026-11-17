import { randomBytes } from "crypto";

function apiKey(): string {
  const key =
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!key) throw new Error("مفتاح Firebase غير مهيأ.");
  return key;
}

function continueUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PASSWORD_RESET_CONTINUE_URL?.trim() ||
    "https://www.tardadi.com/reset-password"
  );
}

async function identityRequest(
  path: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  return { ok: res.ok, message: json.error?.message || "" };
}

export async function lookupFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email: string;
  displayName: string;
} | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  const json = (await res.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string }>;
  };
  const user = json.users?.[0];
  if (!user?.localId || !user.email) return null;
  return {
    uid: user.localId,
    email: user.email,
    displayName: user.displayName || user.email.split("@")[0],
  };
}

export function readFirebaseTokenClaims(
  idToken: string
): { role?: string; businessId?: string | null } {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1] || "", "base64url").toString("utf8")
    ) as { role?: string; businessId?: string | null };
    return payload;
  } catch {
    return {};
  }
}

export async function sendFirebasePasswordSetupEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const resetPayload = {
    requestType: "PASSWORD_RESET",
    email: normalized,
    continueUrl: continueUrl(),
  };

  let result = await identityRequest("accounts:sendOobCode", resetPayload);
  if (!result.ok && result.message.includes("INVALID_CONTINUE_URI")) {
    result = await identityRequest("accounts:sendOobCode", {
      requestType: "PASSWORD_RESET",
      email: normalized,
    });
  }
  if (result.ok) return;

  if (result.message === "EMAIL_NOT_FOUND") {
    const signup = await identityRequest("accounts:signUp", {
      email: normalized,
      password: `Td${randomBytes(12).toString("base64url")}Aa1!`,
      returnSecureToken: false,
    });
    if (!signup.ok && signup.message !== "EMAIL_EXISTS") {
      throw new Error("تعذّر إنشاء حساب الدخول. تحقق من البريد وحاول مرة أخرى.");
    }
    result = await identityRequest("accounts:sendOobCode", resetPayload);
    if (result.ok) return;
  }

  throw new Error("تعذّر إرسال إيميل التفعيل. تحقق من البريد أو صندوق الرسائل غير المرغوب فيها.");
}
