/**
 * Verify Firebase Auth + repair Firestore super_admin for tardadi@tardadi.com.
 * Does NOT modify new@tardadi.com or any other account.
 *
 * Usage:
 *   node scripts/repair-tardadi-admin.mjs
 *
 * Optional:
 *   DRY_RUN=1
 *   ADMIN_EMAIL=tardadi@tardadi.com
 *   ADMIN_UID=r7rEeht20xb9smOSoZE6uMBDOeP2
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "trddk-54c45";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "tardadi@tardadi.com").trim().toLowerCase();
const EXPECTED_UID = (process.env.ADMIN_UID || "r7rEeht20xb9smOSoZE6uMBDOeP2").trim();
const LEGACY_ADMIN_ID = (process.env.LEGACY_ADMIN_ID || "lama").trim().toLowerCase();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

function fieldString(value) {
  return { stringValue: String(value) };
}

function readStringField(fields, key) {
  const v = fields?.[key];
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  return null;
}

async function fetchAccessToken() {
  const account = getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Run `firebase login --reauth` first.");
  }
  const token = await getAccessToken(account.tokens.refresh_token, [
    scopes.CLOUD_PLATFORM,
  ]);
  return token.access_token;
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
    throw new Error(`Auth API failed (${res.status}): ${msg}`);
  }
  return payload;
}

async function lookupAuthUserByEmail(accessToken, email) {
  const data = await authRequest(accessToken, "/accounts:lookup", {
    email: [email],
  });
  return data.users?.[0] ?? null;
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

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Admin email: ${ADMIN_EMAIL}`);
  console.log(`Expected UID: ${EXPECTED_UID}`);
  console.log(`DRY_RUN=${DRY_RUN}`);

  const accessToken = await fetchAccessToken();

  const authUser = await lookupAuthUserByEmail(accessToken, ADMIN_EMAIL);
  if (!authUser?.localId) {
    throw new Error(`Firebase Auth user not found for ${ADMIN_EMAIL}`);
  }

  const uid = authUser.localId;
  console.log(`Firebase Auth: found uid=${uid}`);
  if (uid !== EXPECTED_UID) {
    throw new Error(
      `UID mismatch: expected ${EXPECTED_UID}, Firebase Auth has ${uid}`
    );
  }
  if (authUser.disabled) {
    throw new Error("Firebase Auth user is disabled.");
  }

  const existing = await firestoreGet(accessToken, `users/${uid}`);
  const existingFields = existing?.fields ?? {};
  const displayName =
    readStringField(existingFields, "displayName") ||
    readStringField(existingFields, "name") ||
    "Lama";

  console.log("Firestore users doc:", existing ? "exists (merge repair)" : "missing (create)");

  if (DRY_RUN) {
    console.log("Dry run — no writes.");
    return;
  }

  const now = new Date().toISOString();
  const docName = `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const mergedFields = {
    email: fieldString(ADMIN_EMAIL),
    displayName: fieldString(displayName),
    primaryRole: fieldString("super_admin"),
    status: fieldString("active"),
    updatedAt: fieldString(now),
    repairedAt: fieldString(now),
  };

  if (!existing) {
    mergedFields.createdAt = fieldString(now);
    mergedFields.legacyAdminUserId = fieldString(LEGACY_ADMIN_ID);
  }

  const fieldPaths = Object.keys(mergedFields);
  await firestoreCommit(accessToken, [
    {
      update: { name: docName, fields: mergedFields },
      updateMask: { fieldPaths },
    },
  ]);
  console.log(`Repaired users/${uid} (primaryRole=super_admin, status=active)`);

  await authRequest(accessToken, "/accounts:update", {
    localId: uid,
    customAttributes: JSON.stringify({
      role: "super_admin",
      businessId: null,
      status: "active",
    }),
  });
  console.log("Updated Firebase custom claims: super_admin");

  const legacyName = `projects/${PROJECT_ID}/databases/(default)/documents/admin_users/${LEGACY_ADMIN_ID}`;
  await firestoreCommit(accessToken, [
    {
      update: {
        name: legacyName,
        fields: {
          email: fieldString(ADMIN_EMAIL),
          firebaseUid: fieldString(uid),
          updatedAt: fieldString(now),
        },
      },
      updateMask: { fieldPaths: ["email", "firebaseUid", "updatedAt"] },
    },
  ]);
  console.log(`Linked admin_users/${LEGACY_ADMIN_ID} → ${uid}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
