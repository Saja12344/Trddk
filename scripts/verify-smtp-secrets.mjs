/**
 * Verify SMTP Secret Manager entries without printing sensitive values.
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getAccessToken, getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const PROJECT = process.env.GCLOUD_PROJECT_NUMBER || "815276520530";
const SENSITIVE = new Set(["SMTP_PASSWORD", "ADMIN_JWT_SECRET"]);

const EXPECTED = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_USER: process.env.EXPECTED_SMTP_USER || "new@tardadi.com",
  SMTP_FROM: process.env.EXPECTED_SMTP_FROM || "TRDDK <new@tardadi.com>",
};

async function main() {
  const account = getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Run `firebase login --reauth` first.");
  }

  const token = await getAccessToken(account.tokens.refresh_token, [
    scopes.CLOUD_PLATFORM,
  ]);
  const headers = { Authorization: `Bearer ${token.access_token}` };

  let ok = true;

  for (const name of [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "ADMIN_JWT_SECRET",
  ]) {
    const metaRes = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${name}`,
      { headers }
    );
    if (!metaRes.ok) {
      console.log(`${name}: MISSING`);
      ok = false;
      continue;
    }

    const versionsRes = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${name}/versions?pageSize=5`,
      { headers }
    );
    const versionsBody = versionsRes.ok ? await versionsRes.json() : { versions: [] };
    const enabled = (versionsBody.versions || []).filter((v) => v.state === "ENABLED");
    if (!enabled.length) {
      console.log(`${name}: no ENABLED version`);
      ok = false;
      continue;
    }

    const latest = enabled[0];
    const versionId = latest.name.split("/").pop();

    if (SENSITIVE.has(name)) {
      console.log(`${name}: enabled (${versionId})`);
      continue;
    }

    const accessRes = await fetch(
      `https://secretmanager.googleapis.com/v1/${latest.name}:access`,
      { headers }
    );
    const payload = accessRes.ok ? await accessRes.json() : null;
    const value = payload?.payload?.data
      ? Buffer.from(payload.payload.data, "base64").toString("utf8").trim()
      : "";

    const expected = EXPECTED[name];
    const match = expected === undefined || value === expected;
    if (!match) ok = false;

    console.log(
      `${name}: enabled (${versionId})${expected !== undefined ? (match ? " OK" : ` MISMATCH expected ${JSON.stringify(expected)}`) : ""}`
    );
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
