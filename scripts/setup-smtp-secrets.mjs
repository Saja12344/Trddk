/**
 * Store SMTP credentials in Firebase Secret Manager for Cloud Functions.
 *
 * Usage (Gmail / Google Workspace example):
 *   SMTP_HOST=smtp.gmail.com \
 *   SMTP_PORT=587 \
 *   SMTP_USER=support@tardadi.com \
 *   SMTP_PASS='your-16-char-app-password' \
 *   SMTP_FROM=support@tardadi.com \
 *   node scripts/setup-smtp-secrets.mjs
 *
 * Gmail App Password: Google Account → Security → 2-Step Verification → App passwords
 */
import { spawnSync } from "child_process";

const PROJECT = process.env.GCLOUD_PROJECT || "trddk-54c45";

const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error("Missing environment variables:", missing.join(", "));
  console.error(`
Example (Gmail):
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=support@tardadi.com
  SMTP_PASS=xxxx xxxx xxxx xxxx   # Google App Password (not your login password)
  SMTP_FROM=support@tardadi.com
`);
  process.exit(1);
}

function setSecret(name, value) {
  console.log(`Setting secret ${name}...`);
  const result = spawnSync(
    "npx",
    ["firebase-tools", "functions:secrets:set", name, "--project", PROJECT, "--force"],
    {
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      encoding: "utf8",
    }
  );
  if (result.status !== 0) {
    throw new Error(`Failed to set secret ${name}`);
  }
}

async function main() {
  console.log(`Project: ${PROJECT}`);

  setSecret("SMTP_HOST", process.env.SMTP_HOST.trim());
  if (process.env.SMTP_PORT?.trim()) {
    setSecret("SMTP_PORT", process.env.SMTP_PORT.trim());
  }
  setSecret("SMTP_USER", process.env.SMTP_USER.trim());
  setSecret("SMTP_PASSWORD", process.env.SMTP_PASSWORD.trim());
  setSecret("SMTP_FROM", process.env.SMTP_FROM.trim());

  if (process.env.ADMIN_JWT_SECRET?.trim()) {
    setSecret("ADMIN_JWT_SECRET", process.env.ADMIN_JWT_SECRET.trim());
  } else {
    console.log("Skipping ADMIN_JWT_SECRET (already set or not provided).");
  }

  console.log(`
Done. Redeploy Functions so secrets take effect:

  cd ${process.cwd()}
  npx firebase-tools deploy --only functions:api --project ${PROJECT}

Then test login at https://www.tardadi.com/login
`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
