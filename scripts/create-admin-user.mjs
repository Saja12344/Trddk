/**
 * Create or update a super admin in production Firestore using Firebase CLI credentials.
 *
 * Usage:
 *   ADMIN_USERNAME=lama ADMIN_PASSWORD='...' node scripts/create-admin-user.mjs
 */
import { randomBytes, scryptSync } from "crypto";
import { createInterface } from "readline";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");
const PROJECT_ID = process.env.GCLOUD_PROJECT || "trddk-54c45";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString(
    "hex"
  );
  return `scrypt:${salt}:${hash}`;
}

async function readPasswordFromStdin() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question("Admin password: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function fetchAccessToken() {
  const account = getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Run `firebase login` first.");
  }
  const token = await getAccessToken(account.tokens.refresh_token, [
    scopes.CLOUD_PLATFORM,
  ]);
  return token.access_token;
}

async function firestoreCommit(accessToken, writes) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
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

function fieldString(value) {
  return { stringValue: value };
}

function fieldBool(value) {
  return { booleanValue: value };
}

function fieldNull() {
  return { nullValue: null };
}

async function findAdminDocName(accessToken, username) {
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const res = await fetch(queryUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "admin_users" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "username" },
                  op: "EQUAL",
                  value: fieldString(username),
                },
              },
            ],
          },
        },
        limit: 1,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Firestore query failed (${res.status})`);
  }
  const rows = await res.json();
  const doc = rows.find((row) => row.document)?.document;
  return doc?.name?.split("/").pop() || username;
}

async function main() {
  const username = (process.env.ADMIN_USERNAME || "lama").trim().toLowerCase();
  const displayName = process.env.ADMIN_NAME?.trim() || "Lama";
  let password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) password = await readPasswordFromStdin();
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const accessToken = await fetchAccessToken();
  const docId = await findAdminDocName(accessToken, username);
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const docName = `projects/${PROJECT_ID}/databases/(default)/documents/admin_users/${docId}`;

  await firestoreCommit(accessToken, [
    {
      update: {
        name: docName,
        fields: {
          username: fieldString(username),
          name: fieldString(displayName),
          phone: fieldNull(),
          passwordHash: fieldString(passwordHash),
          role: fieldString("super_admin"),
          businessId: fieldNull(),
          status: fieldString("active"),
          mustChangePassword: fieldBool(true),
          updatedAt: fieldString(now),
          ...(docId === username ? { createdAt: fieldString(now) } : {}),
        },
      },
      updateMask: {
        fieldPaths: [
          "username",
          "name",
          "phone",
          "passwordHash",
          "role",
          "businessId",
          "status",
          "mustChangePassword",
          "updatedAt",
          ...(docId === username ? ["createdAt"] : []),
        ],
      },
    },
  ]);

  console.log(`Super admin ready: username="${username}" id="${docId}"`);
  console.log("Password was hashed — not logged.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
