/**
 * Create or update a super admin account in Firestore.
 *
 * Usage (password never stored in repo):
 *   ADMIN_USERNAME=lama ADMIN_PASSWORD='...' npx ts-node scripts/create-admin-user.ts
 *
 * Requires Application Default Credentials for project trddk-54c45.
 */
import * as admin from "firebase-admin";
import { randomBytes, scryptSync } from "crypto";
import * as readline from "readline";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "trddk-54c45";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString(
    "hex"
  );
  return `scrypt:${salt}:${hash}`;
}

async function readPasswordFromStdin(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question("Admin password: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const username = (process.env.ADMIN_USERNAME || "lama").trim().toLowerCase();
  const displayName = process.env.ADMIN_NAME?.trim() || "Lama";
  let password = process.env.ADMIN_PASSWORD?.trim();

  if (!password) {
    password = await readPasswordFromStdin();
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  const existing = await db
    .collection("admin_users")
    .where("username", "==", username)
    .limit(1)
    .get();

  const docRef = existing.empty
    ? db.collection("admin_users").doc(username)
    : existing.docs[0].ref;

  await docRef.set(
    {
      username,
      name: displayName,
      phone: null,
      passwordHash,
      role: "super_admin",
      businessId: null,
      status: "active",
      mustChangePassword: true,
      updatedAt: now,
      ...(existing.empty ? { createdAt: now } : {}),
    },
    { merge: true }
  );

  console.log(`Super admin ready: username="${username}" id="${docRef.id}"`);
  console.log("Password was hashed — not logged.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
