# Deployment Guide

> **This document is instructions only.** The handoff PR does not execute deploys.

## Pre-flight checklist

- [ ] Firebase CLI logged in: `firebase login`
- [ ] Active project: `firebase use trddk-54c45` (verify with `firebase projects:list`)
- [ ] **Not** `tardadi-5bd8e` or any other project ID
- [ ] Production env vars contain **no** `localhost` or emulator URLs
- [ ] Secrets exist in Secret Manager (`ADMIN_JWT_SECRET`, `SUPPORT_EMAIL`, SMTP if using email)
- [ ] Google Maps keys created and restricted (HTTP referrer + API restrictions)

## Firebase project

| Setting | Value |
|---------|--------|
| Project ID | `trddk-54c45` |
| Functions region | `us-central1` |
| Firestore | `(default)` |

```bash
firebase use trddk-54c45
firebase projects:list
```

## Deploy Cloud Functions

From repository root:

```bash
npm run build:shared
firebase deploy --only functions --project trddk-54c45
```

Predeploy (in `firebase.json`) runs:

1. Build `@tardadi/shared`
2. `scripts/bundle-functions.js` → `firebase/functions/dist/bundle.js`
3. Functions TypeScript compile check

### Verify Functions

```bash
firebase functions:list --project trddk-54c45
curl -sS "https://us-central1-trddk-54c45.cloudfunctions.net/api/api/health"
```

Expected: HTTP 200 with `"firestore":"ok"` when Firestore IAM is correct.

> Direct browser access to Cloud Functions may return **403** if org policy blocks public Cloud Run invoker. That is expected — Admin BFF uses service account auth.

### Secrets

```bash
firebase functions:secrets:set ADMIN_JWT_SECRET --project trddk-54c45
firebase functions:secrets:set SUPPORT_EMAIL --project trddk-54c45
# SMTP secrets as needed for password reset email
```

Wire secrets in `firebase/functions/src/index.ts` `onRequest` secrets array.

## Deploy Admin (Firebase App Hosting)

**Source of truth:** `apps/admin`

**Deploy bundle:** `apphosting-staging/` (generated — do not edit manually)

```bash
node scripts/prepare-admin-apphosting.js
firebase deploy --only apphosting --project trddk-54c45
```

Config: `firebase.json` → `apphosting.backendId: tardadi-admin`, `rootDir: apphosting-staging`.

### Required App Hosting environment variables

Set in Firebase Console → App Hosting → backend → Environment, and/or `apps/admin/apphosting.yaml`:

| Variable | Required | Notes |
|----------|----------|-------|
| `TARDADI_API_URL` | Yes | Production Functions URL |
| `ADMIN_PUBLIC_URL` | Yes | Public admin URL for reset links |
| `SUPPORT_EMAIL` | Yes | e.g. `support@tardadi.com` |
| `NEXT_PUBLIC_GOOGLE_MAPS_DISPLAY` | Recommended | `true` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Recommended | Browser-restricted |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Recommended | Map ID |
| `GOOGLE_MAPS_API_KEY` | Recommended | Server geocode/routing |

Runtime service account: `tardadi-admin-bff@trddk-54c45.iam.gserviceaccount.com` must have **`roles/run.invoker`** on Cloud Run service `api`.

### Verify Admin

```bash
firebase apphosting:backends:list --project trddk-54c45
curl -sS "https://tardadi-admin--trddk-54c45.us-central1.hosted.app/api/health"
```

Test login and authenticated proxy routes from the deployed domain.

## Deploy Firestore rules / indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes --project trddk-54c45
```

## Firebase Hosting (static site)

Root hosting (`trddk-54c45.web.app`) serves static placeholder + rewrite to `api` function — **not** the Admin Next.js app.

```bash
firebase deploy --only hosting --project trddk-54c45
```

## Flutter mobile apps

Not deployed via Firebase Hosting. Standard store release:

1. Configure signing (Android keystore, iOS certificates).
2. Build release APK/IPA.
3. Do **not** change bundle IDs without store listing updates.

Use production API URL via `--dart-define=API_URL=...` at build time.

## Rollback

### Functions

Redeploy previous git tag/commit:

```bash
git checkout <known-good-commit>
npm run build:shared
firebase deploy --only functions --project trddk-54c45
```

Or use Cloud Console → Cloud Functions → revision traffic (Gen2 / Cloud Run).

### App Hosting

Firebase Console → App Hosting → roll back to previous successful rollout.

### Firestore rules

Keep previous `firebase/firestore.rules` in git; redeploy from last known good commit.

## Post-deploy smoke test

1. `GET /api/health` on Admin domain → upstream OK
2. Admin login (super admin)
3. Load businesses, routes, trips pages
4. Maps render without Carto watermark (if Google configured)
5. Driver app: login + start trip against production API (staging device)
6. No `localhost` in network tab API calls

## Create admin user (production)

```bash
ADMIN_USERNAME=lama ADMIN_PASSWORD='...' node scripts/create-admin-user.mjs
```

Requires `firebase login`. Password is **never** stored in git.

## Blockers documented in production

- Org policy may forbid `allUsers` Cloud Run invoker — use BFF only
- Org policy may forbid service account key creation — App Hosting must use attached SA (ADC)
- SMTP must be configured for password reset emails
