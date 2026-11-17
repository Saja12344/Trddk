/**
 * Safe SMTP delivery probe via deployed API (no credentials printed).
 *
 * Usage:
 *   node scripts/test-smtp-delivery.mjs tardadi@tardadi.com
 */
const API_URL =
  process.env.TARDADI_API_URL?.trim() ||
  "https://us-central1-trddk-54c45.cloudfunctions.net/api";

const email = process.argv[2]?.trim();
if (!email) {
  console.error("Usage: node scripts/test-smtp-delivery.mjs <admin-email>");
  process.exit(1);
}

const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/auth/passenger-send-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});

const body = await res.json().catch(() => ({}));

if (res.ok && body.success) {
  console.log(`SMTP probe: delivery accepted for ${email} (HTTP ${res.status})`);
  console.log("Check inbox/spam for TRDDK verification code.");
  process.exit(0);
}

const error = String(body.error || "unknown error");
console.log(`SMTP probe: failed (HTTP ${res.status})`);
console.log(`Category: ${error}`);
process.exit(1);
