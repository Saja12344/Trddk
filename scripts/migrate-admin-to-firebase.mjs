/**
 * Migrate admin_users documents to Firebase Auth + users/{uid} profiles.
 *
 * Usage (requires Application Default Credentials or firebase login):
 *   DRY_RUN=1 node scripts/migrate-admin-to-firebase.mjs
 *   LAMA_EMAIL=lama@example.com node scripts/migrate-admin-to-firebase.mjs
 *
 * Never pass passwords on the command line in production logs.
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "trddk-54c45";
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();
const auth = admin.auth();

function normalizeEmail(value, fallbackId) {
  if (value && value.includes("@")) return value.trim().toLowerCase();
  const domain = process.env.TRDDK_MIGRATION_EMAIL_DOMAIN || "trddk.local";
  return `${fallbackId}@${domain}`.toLowerCase();
}

async function migrateAdminDoc(doc) {
  const data = doc.data();
  const legacyId = doc.id;
  const displayName = (data.name || legacyId).trim();
  const email = normalizeEmail(data.email || data.login || null, legacyId);
  const primaryRole = data.role === "business_admin" ? "business_admin" : "super_admin";
  const businessId = data.businessId || null;

  console.log(`→ ${legacyId}: ${email} (${primaryRole})`);

  if (DRY_RUN) {
    return { legacyId, email, uid: "(dry-run)" };
  }

  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`  linked existing Firebase user ${uid}`);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const created = await auth.createUser({
      email,
      displayName,
      disabled: data.status !== "active",
    });
    uid = created.uid;
    console.log(`  created Firebase user ${uid}`);
  }

  await db.collection("users").doc(uid).set(
    {
      email,
      displayName,
      primaryRole,
      status: data.status === "active" ? "active" : "suspended",
      legacyAdminUserId: legacyId,
      migratedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  if (businessId && primaryRole === "business_admin") {
    await db
      .collection("users")
      .doc(uid)
      .collection("memberships")
      .doc(businessId)
      .set(
        {
          role: "business_admin",
          status: "active",
          joinedAt: new Date().toISOString(),
          source: "migration",
        },
        { merge: true }
      );
  }

  await auth.setCustomUserClaims(uid, {
    role: primaryRole,
    businessId,
    status: data.status === "active" ? "active" : "suspended",
  });

  if (!DRY_RUN && process.env.SKIP_EMAIL !== "1") {
    await sendPasswordSetupEmail(email);
  }

  return { legacyId, email, uid };
}

async function sendPasswordSetupEmail(email) {
  const apiKey =
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    "";
  const continueUrl =
    process.env.TRDDK_PASSWORD_RESET_URL ||
    "https://tardadi-admin--trddk-54c45.us-central1.hosted.app/login";

  if (!apiKey) {
    const link = await auth.generatePasswordResetLink(email, {
      url: continueUrl,
      handleCodeInApp: false,
    });
    console.log(`  reset link (no API key — not emailed): ${link.slice(0, 72)}...`);
    return;
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Password reset email failed: ${text.slice(0, 120)}`);
  }
  console.log(`  password setup email sent to ${email}`);
}

async function main() {
  console.log(`Project: ${PROJECT_ID}  DRY_RUN=${DRY_RUN}`);
  const snap = await db.collection("admin_users").get();
  if (snap.empty) {
    console.log("No admin_users documents found.");
    return;
  }

  const results = [];
  for (const doc of snap.docs) {
    results.push(await migrateAdminDoc(doc));
  }

  console.log("\nMigration summary:");
  for (const row of results) {
    console.log(`  ${row.legacyId} → ${row.email} (${row.uid})`);
  }

  if (!DRY_RUN) {
    console.log(
      "\nNext: set LAMA real email in Firebase Console, run sendPasswordResetEmail for each account."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
