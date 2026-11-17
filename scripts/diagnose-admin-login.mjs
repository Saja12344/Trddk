/**
 * Diagnose admin login blockers for an email (no secrets printed).
 *
 * Usage:
 *   node scripts/diagnose-admin-login.mjs tardadi@tardadi.com
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const PROJECT = process.env.GCLOUD_PROJECT || "trddk-54c45";
const PROJECT_NUMBER = process.env.GCLOUD_PROJECT_NUMBER || "815276520530";
const WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
  "";
const API_URL =
  process.env.TARDADI_API_URL?.trim() ||
  "https://us-central1-trddk-54c45.cloudfunctions.net/api";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/diagnose-admin-login.mjs <email>");
  process.exit(1);
}

async function firebaseLookup(email) {
  if (!WEB_API_KEY) return { error: "missing FIREBASE_WEB_API_KEY" };
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: [email] }),
    }
  );
  const body = await res.json();
  if (!res.ok) return { error: body.error?.message || res.status };
  const user = body.users?.[0];
  if (!user) return { exists: false };
  return {
    exists: true,
    uid: user.localId,
    disabled: user.disabled === true,
    emailVerified: user.emailVerified === true,
  };
}

async function firestoreUserProfile(accessToken, uid) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_NUMBER}/databases/(default)/documents/users/${uid}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) return { error: `Firestore ${res.status}` };
  const doc = await res.json();
  const f = doc.fields || {};
  const read = (k) => f[k]?.stringValue ?? null;
  return {
    primaryRole: read("primaryRole"),
    status: read("status"),
    email: read("email"),
  };
}

async function smtpProbe() {
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/auth/passenger-send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => ({}));
  return { http: res.status, error: body.error || null, success: body.success === true };
}

async function main() {
  console.log(`Diagnosis for ${email}`);
  console.log(`Project: ${PROJECT}`);
  console.log("");

  const auth = await firebaseLookup(email);
  console.log("1) Firebase Auth");
  if (auth.error) {
    console.log(`   ERROR: ${auth.error}`);
  } else if (!auth.exists) {
    console.log("   FAIL: no Firebase Auth user — use Forgot password or provision first");
  } else {
    console.log(`   OK: uid=${auth.uid}`);
    console.log(`   disabled=${auth.disabled} emailVerified=${auth.emailVerified}`);
  }

  let profile = null;
  if (auth.uid) {
    const account = getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token) {
      console.log("\n2) Firestore users/{uid}");
      console.log("   SKIP: run firebase login --reauth to inspect profile");
    } else {
      const token = await getAccessToken(account.tokens.refresh_token, [
        scopes.CLOUD_PLATFORM,
      ]);
      profile = await firestoreUserProfile(token.access_token, auth.uid);
      console.log("\n2) Firestore admin profile");
      if (!profile) {
        console.log("   FAIL: users/{uid} missing — run setup-super-admin for this email");
      } else if (profile.error) {
        console.log(`   ERROR: ${profile.error}`);
      } else {
        console.log(`   primaryRole=${profile.primaryRole}`);
        console.log(`   status=${profile.status}`);
        const adminRoles = ["super_admin", "platform_admin", "business_admin", "business_viewer"];
        if (!adminRoles.includes(profile.primaryRole || "")) {
          console.log("   FAIL: not an admin panel role");
        } else if (profile.status !== "active" && profile.status !== "pending") {
          console.log("   FAIL: account status blocks login");
        } else {
          console.log("   OK: admin profile looks valid");
        }
      }
    }
  }

  console.log("\n3) SMTP / OTP on deployed Functions");
  const smtp = await smtpProbe();
  if (smtp.success) {
    console.log("   OK: email delivery accepted");
  } else {
    console.log(`   FAIL: ${smtp.error || "unknown"}`);
    console.log("   → deploy functions:api with SMTP secrets bound");
  }

  console.log("\n--- Likely blocker ---");
  if (auth.error) {
    console.log("Cannot complete diagnosis (Firebase API key / auth).");
  } else if (!auth.exists) {
    console.log("Create Firebase user + set password (Forgot password flow).");
  } else if (!profile) {
    console.log("Firebase OK but Firestore admin profile missing → mfa-challenge returns Invalid credentials.");
    console.log(`Fix: LAMA_EMAIL=${email} SKIP_EMAIL=1 node scripts/setup-super-admin.mjs`);
  } else if (!smtp.success) {
    console.log("Admin profile may exist but OTP email cannot send until Functions redeployed with SMTP secrets.");
  } else {
    console.log("Infrastructure looks OK — if login still fails, password is wrong at Firebase step.");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
