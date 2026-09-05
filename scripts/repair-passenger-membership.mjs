/**
 * Repair passenger membership for an existing admin account (passengerAccess only).
 *
 * Usage:
 *   node scripts/repair-passenger-membership.mjs
 *
 * Optional:
 *   DRY_RUN=1
 *   PASSENGER_EMAIL=sajakhalid37@gmail.com
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "trddk-54c45";
const PASSENGER_EMAIL = (
  process.env.PASSENGER_EMAIL || "sajakhalid37@gmail.com"
).trim().toLowerCase();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

function readStringField(fields, key) {
  const v = fields?.[key];
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  return null;
}

function readBoolField(fields, key) {
  const v = fields?.[key];
  if (!v) return null;
  if ("booleanValue" in v) return v.booleanValue;
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

async function firestorePatch(accessToken, docPath, fields) {
  const updateMask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join("&");
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}?${updateMask}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore PATCH ${docPath} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function listMemberships(accessToken, uid) {
  const res = await fetch(
    `${FIRESTORE_BASE}/users/${uid}/memberships`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore list memberships failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.documents ?? [];
}

function membershipSummary(doc) {
  const id = doc.name.split("/").pop();
  const f = doc.fields ?? {};
  return {
    path: `users/${doc.name.split("/users/")[1]}`,
    businessId: id,
    role: readStringField(f, "role"),
    status: readStringField(f, "status"),
    passengerAccess: readBoolField(f, "passengerAccess"),
    driverAccess: readBoolField(f, "driverAccess"),
  };
}

async function main() {
  const accessToken = await fetchAccessToken();
  const authUser = await lookupAuthUserByEmail(accessToken, PASSENGER_EMAIL);
  if (!authUser?.localId) {
    throw new Error(`Firebase Auth user not found for ${PASSENGER_EMAIL}`);
  }

  const uid = authUser.localId;
  const userDoc = await firestoreGet(accessToken, `users/${uid}`);
  if (!userDoc?.fields) {
    throw new Error(`Firestore users/${uid} not found`);
  }

  const beforeUser = {
    path: `users/${uid}`,
    primaryRole: readStringField(userDoc.fields, "primaryRole"),
    status: readStringField(userDoc.fields, "status"),
    email: readStringField(userDoc.fields, "email"),
  };

  console.log("BEFORE user:", beforeUser);

  const membershipDocs = await listMemberships(accessToken, uid);
  const memberships = membershipDocs.map(membershipSummary);
  console.log(
    "BEFORE memberships:",
    memberships.map(({ path, businessId, role, status, passengerAccess, driverAccess }) => ({
      path,
      businessId,
      role,
      status,
      passengerAccess,
      driverAccess,
    }))
  );

  const eligible = memberships.filter(
    (m) => m.status === "active" || m.status === "pending"
  );

  if (eligible.length === 0) {
    console.error(
      "STOP: No active/pending company membership found. Candidate business IDs: none."
    );
    process.exit(1);
  }

  if (eligible.length > 1) {
    console.error(
      "STOP: Multiple active/pending memberships — cannot pick one unambiguously."
    );
    console.error(
      "Candidate business IDs:",
      eligible.map((m) => m.businessId)
    );
    process.exit(1);
  }

  const target = eligible[0];
  const membershipPath = `users/${uid}/memberships/${target.businessId}`;

  if (target.passengerAccess === true) {
    console.log("Membership already has passengerAccess: true — no change needed.");
    return;
  }

  const patchFields = {
    passengerAccess: { booleanValue: true },
  };

  if (target.status !== "active" && target.status !== "pending") {
    patchFields.status = { stringValue: "active" };
  }

  console.log("REPAIR target:", {
    path: membershipPath,
    changes: {
      passengerAccess: true,
      ...(patchFields.status ? { status: "active" } : {}),
    },
  });

  if (DRY_RUN) {
    console.log("DRY_RUN=1 — no write performed.");
    return;
  }

  await firestorePatch(accessToken, membershipPath, patchFields);

  const afterUserDoc = await firestoreGet(accessToken, `users/${uid}`);
  const afterUser = {
    path: `users/${uid}`,
    primaryRole: readStringField(afterUserDoc.fields, "primaryRole"),
    status: readStringField(afterUserDoc.fields, "status"),
    email: readStringField(afterUserDoc.fields, "email"),
  };
  console.log("AFTER user:", afterUser);

  const afterMembershipDoc = await firestoreGet(accessToken, membershipPath);
  const afterMembership = membershipSummary(afterMembershipDoc);
  console.log("AFTER membership:", {
    path: afterMembership.path,
    businessId: afterMembership.businessId,
    role: afterMembership.role,
    status: afterMembership.status,
    passengerAccess: afterMembership.passengerAccess,
    driverAccess: afterMembership.driverAccess,
  });

  if (afterUser.primaryRole !== beforeUser.primaryRole) {
    throw new Error("Admin primaryRole changed — abort verification failed.");
  }
  if (afterMembership.passengerAccess !== true) {
    throw new Error("passengerAccess repair failed verification.");
  }
  console.log("Repair verified: admin primaryRole preserved, passengerAccess enabled.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
