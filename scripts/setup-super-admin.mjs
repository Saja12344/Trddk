/**
 * Create or link a super_admin Firebase Auth user and Firestore profile.
 * Uses Firebase CLI credentials (firebase login) — no ADC / service account required.
 * Sends a password-setup email via Firebase (no SMTP, no password in Git).
 *
 * Usage:
 *   LAMA_EMAIL=tardadi@tardadi.com node scripts/setup-super-admin.mjs
 *
 * Optional:
 *   ADMIN_UID=r7rEeht20xb9smOSoZE6uMBDOeP2  — verify linked Firebase UID
 *   DRY_RUN=1       — print actions only
 *   SKIP_EMAIL=1    — skip password reset email
 *   FIREBASE_WEB_API_KEY= — for sendOobCode (password reset email)
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "trddk-54c45";
const LEGACY_ADMIN_ID = (process.env.LEGACY_ADMIN_ID || "lama").trim().toLowerCase();
const EXPECTED_ADMIN_UID = process.env.ADMIN_UID?.trim() || "";
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const SKIP_EMAIL = process.env.SKIP_EMAIL === "1" || process.env.SKIP_EMAIL === "true";
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
  "";

const PASSWORD_RESET_CONTINUE_URL =
  process.env.TRDDK_PASSWORD_RESET_URL ||
  "https://tardadi-admin--trddk-54c45.us-central1.hosted.app/login";

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function fieldString(value) {
  return { stringValue: value };
}

function readStringField(fields, key) {
  const v = fields?.[key];
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("nullValue" in v) return null;
  return null;
}

async function fetchAccessToken() {
  const account = getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Run `npx firebase login --reauth` first.");
  }
  const token = await getAccessToken(account.tokens.refresh_token, [
    scopes.CLOUD_PLATFORM,
  ]);
  return token.access_token;
}

async function firestoreGet(accessToken, docPath) {
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore GET ${docPath} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function firestoreCommit(accessToken, writes) {
  const res = await fetch(`${FIRESTORE_BASE}:commit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore commit failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function authRequest(accessToken, path, body) {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload.error?.message || JSON.stringify(payload).slice(0, 200);
    const err = new Error(`Auth API ${path} failed (${res.status}): ${msg}`);
    err.code = payload.error?.message;
    throw err;
  }
  return payload;
}

async function lookupAuthUserByEmail(accessToken, email) {
  try {
    const data = await authRequest(accessToken, "/accounts:lookup", {
      email: [normalizeEmail(email)],
    });
    return data.users?.[0] ?? null;
  } catch (err) {
    if (String(err.code).includes("EMAIL_NOT_FOUND")) return null;
    if (String(err.message).includes("USER_NOT_FOUND")) return null;
    throw err;
  }
}

async function createAuthUser(accessToken, email, displayName, disabled) {
  return authRequest(accessToken, "/accounts", {
    email: normalizeEmail(email),
    displayName,
    disabled,
    emailVerified: false,
  });
}

async function updateAuthCustomClaims(accessToken, localId, claims) {
  return authRequest(accessToken, "/accounts:update", {
    localId,
    customAttributes: JSON.stringify(claims),
  });
}

function resolveEmail(legacyFields) {
  const fromEnv = process.env.LAMA_EMAIL?.trim();
  if (fromEnv) return normalizeEmail(fromEnv);

  const fromDoc =
    readStringField(legacyFields, "email") ||
    readStringField(legacyFields, "login") ||
    (() => {
      const username = readStringField(legacyFields, "username");
      return username?.includes("@") ? username : null;
    })();

  if (fromDoc?.includes("@")) return normalizeEmail(fromDoc);

  throw new Error(
    "Set LAMA_EMAIL to Lama's real email, or add an email field to admin_users/lama in Firestore."
  );
}

async function sendPasswordSetupEmail(email) {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error(
      "Set FIREBASE_WEB_API_KEY (Firebase Web API key) to send the password setup email."
    );
  }

  const payload = {
    requestType: "PASSWORD_RESET",
    email: normalizeEmail(email),
  };

  async function post(body) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  let result = await post({ ...payload, continueUrl: PASSWORD_RESET_CONTINUE_URL });
  if (
    !result.ok &&
    result.text.includes("UNAUTHORIZED_DOMAIN") &&
    PASSWORD_RESET_CONTINUE_URL
  ) {
    console.log("  continueUrl not allowlisted — retrying without custom redirect URL");
    result = await post(payload);
  }

  if (!result.ok) {
    throw new Error(
      `Password reset email failed (${result.status}): ${result.text.slice(0, 200)}`
    );
  }

  console.log(`  password setup email sent to ${email}`);
}

async function writeUserProfile(accessToken, uid, fields) {
  const docName = `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  await firestoreCommit(accessToken, [
    {
      update: {
        name: docName,
        fields: Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, fieldString(String(v))])
        ),
      },
      updateMask: { fieldPaths: Object.keys(fields) },
    },
  ]);
}

async function linkLegacyAdmin(accessToken, email, uid, now) {
  const docName = `projects/${PROJECT_ID}/databases/(default)/documents/admin_users/${LEGACY_ADMIN_ID}`;
  await firestoreCommit(accessToken, [
    {
      update: {
        name: docName,
        fields: {
          email: fieldString(email),
          firebaseUid: fieldString(uid),
          updatedAt: fieldString(now),
        },
      },
      updateMask: { fieldPaths: ["email", "firebaseUid", "updatedAt"] },
    },
  ]);
}

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Legacy admin id: ${LEGACY_ADMIN_ID}`);
  console.log(`DRY_RUN=${DRY_RUN}  SKIP_EMAIL=${SKIP_EMAIL}`);

  const accessToken = await fetchAccessToken();

  const legacyDoc = await firestoreGet(accessToken, `admin_users/${LEGACY_ADMIN_ID}`);
  if (!legacyDoc?.fields) {
    throw new Error(`admin_users/${LEGACY_ADMIN_ID} not found in Firestore.`);
  }

  const email = resolveEmail(legacyDoc.fields);
  const displayName = readStringField(legacyDoc.fields, "name") || "Lama";
  const status =
    readStringField(legacyDoc.fields, "status") === "active" ? "active" : "suspended";

  console.log(`Email: ${email}`);
  console.log(`Display name: ${displayName}`);

  if (DRY_RUN) {
    console.log("\nDry run — no changes written.");
    return;
  }

  let uid;
  let created = false;

  const existing = await lookupAuthUserByEmail(accessToken, email);
  if (existing?.localId) {
    uid = existing.localId;
    console.log(`Linked existing Firebase Auth user: ${uid}`);
    if (EXPECTED_ADMIN_UID && uid !== EXPECTED_ADMIN_UID) {
      throw new Error(
        `UID mismatch: expected ${EXPECTED_ADMIN_UID}, Firebase Auth has ${uid}`
      );
    }
  } else {
    const record = await createAuthUser(
      accessToken,
      email,
      displayName,
      status !== "active"
    );
    uid = record.localId;
    created = true;
    console.log(`Created Firebase Auth user: ${uid}`);
  }

  const now = new Date().toISOString();

  await writeUserProfile(accessToken, uid, {
    email,
    displayName,
    primaryRole: "super_admin",
    status,
    legacyAdminUserId: LEGACY_ADMIN_ID,
    createdAt: now,
    updatedAt: now,
    migratedAt: now,
  });
  console.log(`Wrote users/${uid} (primaryRole: super_admin)`);

  await linkLegacyAdmin(accessToken, email, uid, now);
  console.log(`Linked admin_users/${LEGACY_ADMIN_ID} → firebaseUid ${uid}`);

  await updateAuthCustomClaims(accessToken, uid, {
    role: "super_admin",
    businessId: null,
    status,
  });
  console.log("Set custom claims: super_admin");

  if (!SKIP_EMAIL) {
    await sendPasswordSetupEmail(email);
  }

  console.log("\nDone.");
  console.log(`  legacy: admin_users/${LEGACY_ADMIN_ID}`);
  console.log(`  firebase uid: ${uid}`);
  console.log(`  email: ${email}`);
  console.log(`  created: ${created}`);
  console.log("\nNext: deploy Cloud Functions, then test login at /login.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
