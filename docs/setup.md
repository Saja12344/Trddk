# Development Guide

## Prerequisites

Install and verify:

```bash
node -v          # >= 20
npm -v
flutter --version
firebase --version
java -version    # 21+ for Android
```

Optional: FlutterFire CLI (`dart pub global activate flutterfire_cli`) for regenerating `firebase_options.dart`.

## Clone and install

```bash
git clone <repo-url>
cd tardadi   # repository folder name may still be "tardadi"
npm install
npm run build:shared
```

## Environment: development vs production

| Concern | Development | Production |
|---------|-------------|------------|
| Firebase project | `trddk-54c45` (emulator or real) | **`trddk-54c45` only** |
| `TARDADI_API_URL` | `http://127.0.0.1:5001/trddk-54c45/us-central1/api` | `https://us-central1-trddk-54c45.cloudfunctions.net/api` |
| Admin URL | `http://localhost:3001` | App Hosting / custom domain |
| Maps | `.env.local` Google keys or Carto fallback | App Hosting env vars |
| Secrets | Local `.env` / `.env.local` | Secret Manager + App Hosting env |

**Never** commit `.env.local`, service account JSON, or SMTP passwords.

## Admin panel

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

Minimum for local Admin + emulator backend:

```env
TARDADI_API_URL=http://127.0.0.1:5001/trddk-54c45/us-central1/api
TARDADI_ORG_ID=demo-org
```

For Google Maps (recommended — avoids Carto watermark):

```env
NEXT_PUBLIC_GOOGLE_MAPS_DISPLAY=true
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<browser-restricted-key>
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=<map-id>
GOOGLE_MAPS_API_KEY=<server-restricted-key>
```

Run:

```bash
npm run dev:admin
# or: cd apps/admin && npm run dev
```

Open http://localhost:3001

## Cloud Functions (local)

```bash
cp firebase/functions/.env.example firebase/functions/.env
```

Example:

```env
GCLOUD_PROJECT=trddk-54c45
DEFAULT_BUSINESS_ID=demo-org
JWT_SECRET=local-dev-only-change-me
```

Build and emulators:

```bash
npm run build:shared
npm run dev:backend
# or: npm run emulators
```

Emulator UI: http://localhost:4000 (ports in `firebase.json`: Functions 5001, Firestore 8080).

## Seed demo data (emulator)

```bash
# With emulators running
npx tsx scripts/seed-demo.ts
```

Creates `demo-org` business, sample route, bus, driver, admin users. **Emulator only** — do not run blindly against production.

## Flutter: Passenger

```bash
cd apps/passenger
flutter pub get
flutter run \
  --dart-define=API_URL=http://127.0.0.1:5001/trddk-54c45/us-central1/api \
  --dart-define=FIREBASE_PROJECT_ID=trddk-54c45
```

Helper scripts:

```bash
npm run dev:passenger:ios
npm run dev:passenger:android
```

## Flutter: Driver

```bash
cd apps/driver
flutter pub get
flutter run \
  --dart-define=API_URL=http://127.0.0.1:5001/trddk-54c45/us-central1/api \
  --dart-define=FIREBASE_PROJECT_ID=trddk-54c45
```

Helper scripts:

```bash
npm run dev:driver:ios
npm run dev:driver:android
```

iOS first-time setup: `npm run setup:ios`

Simulator GPS: `scripts/set-sim-location.sh`

## Environment variables reference

### Admin (`apps/admin/.env.local`)

| Variable | Purpose | Secret? |
|----------|---------|---------|
| `TARDADI_API_URL` | Backend base URL | No |
| `TARDADI_ORG_ID` | Default business for dev | No |
| `ADMIN_PUBLIC_URL` | Password reset links | No |
| `SUPPORT_EMAIL` | Support address in emails | No |
| `GOOGLE_MAPS_API_KEY` | Server geocode/routing | Restricted |
| `NEXT_PUBLIC_GOOGLE_MAPS_*` | Client map display | Public (referrer-restrict) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web SDK | Public |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Optional BFF auth (local only if org allows keys) | **Yes** |

### Functions (`firebase/functions/.env`)

| Variable | Purpose | Secret? |
|----------|---------|---------|
| `GCLOUD_PROJECT` | Project ID | No |
| `DEFAULT_BUSINESS_ID` | Dev default tenant | No |
| `JWT_SECRET` | Local JWT signing | **Yes** (dev) |
| `GOOGLE_MAPS_API_KEY` | Routing in Functions | Restricted |
| `ADMIN_JWT_SECRET` | Production (Secret Manager) | **Yes** |
| `SUPPORT_EMAIL` | Production (Secret Manager) | No |
| `SMTP_*` | Email delivery | **Yes** |

## Debugging

### Admin

- Check `/api/health` — includes upstream API status.
- Server logs in terminal running `next dev`.
- Proxy failures: verify `TARDADI_API_URL` and emulator/Functions reachability.

### Functions

- `firebase emulators:start --only functions,firestore`
- Logs in emulator terminal or Cloud Logging in production.

### Flutter

- `flutter run -v`
- API base URL from `AppConfig` / `--dart-define`

## Tests

```bash
# TypeScript
npm run typecheck
cd apps/admin && npm run typecheck
cd firebase/functions && npm run typecheck

# Admin production build
cd apps/admin && npm run build

# Functions bundle
cd firebase/functions && npm run bundle && npm run build

# Flutter
cd packages/tardadi_core && flutter test
cd apps/passenger && flutter analyze && flutter test
cd apps/driver && flutter analyze && flutter test
```

## Common issues

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Admin map shows "API KEY REQUIRED" | Carto fallback without Google env | Set `NEXT_PUBLIC_GOOGLE_MAPS_*` in `.env.local` |
| Admin 502 on login | Backend unreachable or 403 | Start emulators; in prod check BFF service account |
| `demo-org` not found | Emulator empty | Run `scripts/seed-demo.ts` |
| Flutter API errors | Wrong `API_URL` dart-define | Pass emulator or production URL |
| `@tardadi/shared` not found in admin | Workspace not built | `npm run build:shared` from root |
| iOS build fails | CocoaPods | `npm run setup:ios` |

## Scripts reference

See root `README.md` and `scripts/` — key scripts:

- `setup-dev.sh` — full bootstrap
- `dev-backend.sh` — emulators
- `configure-flutterfire.sh` — FlutterFire for `trddk-54c45`
- `create-admin-user.mjs` — production admin user (requires Firebase login)
- `prepare-admin-apphosting.js` — **required before App Hosting deploy**
