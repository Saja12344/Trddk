#!/usr/bin/env bash
# Repair admin profile, verify SMTP secrets, deploy API, probe delivery.
# Admin login: tardadi@tardadi.com | SMTP sender: new@tardadi.com
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${GCLOUD_PROJECT:-trddk-54c45}"
ADMIN_EMAIL="${ADMIN_EMAIL:-tardadi@tardadi.com}"

echo "== 1) Repair Firestore super_admin for ${ADMIN_EMAIL} =="
node scripts/repair-tardadi-admin.mjs

echo ""
echo "== 2) Verify SMTP secrets (non-sensitive values only) =="
EXPECTED_SMTP_USER=new@tardadi.com \
EXPECTED_SMTP_FROM='TRDDK <new@tardadi.com>' \
node scripts/verify-smtp-secrets.mjs

echo ""
echo "== 3) Build =="
npm run build:shared
npm run build:functions

echo ""
echo "== 4) Deploy functions:api =="
firebase deploy --only functions:api --project "$PROJECT"

echo ""
echo "== 5) SMTP delivery probe to admin inbox =="
node scripts/test-smtp-delivery.mjs "$ADMIN_EMAIL"

echo ""
echo "Done. Log in at https://www.tardadi.com/login as ${ADMIN_EMAIL}"
