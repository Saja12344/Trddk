# TRDDK — Bus Tracking Platform

**TRDDK** (product name) is a multi-tenant bus tracking and operations platform. The codebase still uses the legacy identifier **`tardadi`** in package names, bundle IDs, and some paths for backward compatibility — do not rename those without a migration plan.

## What this repository contains

| Component | Technology | Path | Role |
|-----------|------------|------|------|
| Passenger app | Flutter (Dart ^3.11.5) | `apps/passenger` | Riders view routes, live buses, reminders, notifications |
| Driver app | Flutter (Dart ^3.11.5) | `apps/driver` | Drivers start/end trips, send GPS, view assigned route |
| Admin panel | Next.js 15 + React 19 | `apps/admin` | Super/business admins manage businesses, routes, buses, drivers, trips |
| HTTP API | Cloud Functions Gen2 + Express | `firebase/functions` | REST API, auth, Firestore access, routing helpers |
| Shared TS contracts | TypeScript | `packages/shared` | Types, constants, RBAC, API client for Admin + Functions |
| Shared Flutter library | Dart | `packages/tardadi_core` | API client, models, maps, theme, FCM helpers |

**Production Firebase project (current):** `trddk-54c45` · **Region:** `us-central1`

> Do **not** point local or production config at the old project `tardadi-5bd8e` (not referenced in this repo).

## Architecture

Admin uses a **Next.js BFF**: the browser calls `/api/*` on the Admin host; server routes proxy to Cloud Functions with service-account auth where required.

```mermaid
flowchart TD
    Browser["Admin browser"]
    BFF["Next.js BFF /api/*"]
    API["Cloud Functions API"]
    Firestore["Cloud Firestore"]
    FCM["Firebase Cloud Messaging"]

    Passenger["Passenger Flutter app"]
    Driver["Driver Flutter app"]

    Passenger --> API
    Driver --> API
    Browser --> BFF
    BFF --> API
    API --> Firestore
    API --> FCM
```

## Trip flow (simplified)

```mermaid
sequenceDiagram
    participant Driver
    participant API
    participant Firestore
    participant Passenger

    Driver->>API: POST /api/trips/start
    API->>Firestore: Create active trip + update bus
    loop While trip active
        Driver->>API: POST /api/gps
        API->>Firestore: Append gps_logs + update bus location
    end
    Passenger->>API: GET /api/routes/:id/live
    API->>Firestore: Read routes, buses, active trips
    API-->>Passenger: Live positions / ETA data
    Driver->>API: POST /api/trips/end
    API->>Firestore: Close trip
```

## Repository layout

```
apps/
  passenger/          # Flutter passenger app
  driver/             # Flutter driver app
  admin/              # Next.js admin panel (source of truth)
firebase/
  functions/          # Cloud Functions Express API
  firestore.rules     # Security rules
  firestore.indexes.json
packages/
  shared/             # TypeScript shared package (@tardadi/shared)
  tardadi_core/       # Flutter shared package
scripts/              # Setup, emulators, deploy helpers, seed
docs/                 # Developer handoff documentation
```

## Requirements

Extracted from project files (verify locally with `node -v`, `flutter --version`):

| Tool | Version / note |
|------|----------------|
| Node.js | >= 20 (`package.json` engines; Functions `node: 20`) |
| npm | Workspaces monorepo (root `package.json`) |
| Flutter | SDK ^3.11.5 (`apps/*/pubspec.yaml`) |
| Firebase CLI | Used for emulators, deploy (`firebase-tools` in root devDependencies) |
| FlutterFire CLI | Optional — `scripts/configure-flutterfire.sh` |
| Java | 21 recommended for Android builds (see `docs/DEVELOPMENT.md`) |
| Xcode / CocoaPods | iOS builds (`scripts/setup-ios.sh`) |

## Quick start (development)

```bash
# 1. Install JS dependencies and build shared package
npm install
npm run build:shared

# 2. Functions env (emulator)
cp firebase/functions/.env.example firebase/functions/.env

# 3. Admin env (local)
cp apps/admin/.env.example apps/admin/.env.local
# Set TARDADI_API_URL to emulator URL (see .env.example)

# 4. Start emulators (Firestore + Functions)
npm run emulators

# 5. Admin (separate terminal)
npm run dev:admin

# 6. Flutter apps
npm run setup          # optional full bootstrap
cd apps/driver && flutter pub get && flutter run
cd apps/passenger && flutter pub get && flutter run
```

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for full setup, emulators, and troubleshooting.

## Environment variables

No real secrets in git. See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** and `apps/admin/.env.example`, `firebase/functions/.env.example`.

| Variable | Secret? | Local | Production |
|----------|---------|-------|------------|
| `TARDADI_API_URL` | No | Emulator URL | Cloud Functions URL |
| `ADMIN_JWT_SECRET` | **Yes** | Dev only | Secret Manager |
| `GOOGLE_MAPS_API_KEY` | Restricted | Optional | Required for maps/geocode |
| `NEXT_PUBLIC_GOOGLE_MAPS_*` | Public, restrict by referrer | Optional | Required for Admin maps |
| Firebase `NEXT_PUBLIC_*` | Public client config | From Firebase console | App Hosting / env |
| SMTP_* | **Yes** | Optional | Required for password reset email |

## Firebase

| Item | Value |
|------|--------|
| Project ID | `trddk-54c45` |
| Region | `us-central1` |
| Firestore | `(default)` database |
| Functions export | Single HTTPS function `api` |
| Admin deploy target | Firebase **App Hosting** backend `tardadi-admin` (see `docs/DEPLOYMENT.md`) |

Details: **[docs/FIRESTORE.md](docs/FIRESTORE.md)**, **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Tests

```bash
npm run typecheck                    # All TS workspaces (if configured)
cd apps/admin && npm run typecheck && npm run build
cd firebase/functions && npm run typecheck && npm run build
cd packages/tardadi_core && flutter test
cd apps/passenger && flutter analyze && flutter test
cd apps/driver && flutter analyze && flutter test
```

## Deployment

Do **not** deploy from this handoff branch without review. Summary: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Known issues (verified)

| Issue | Status | Notes |
|-------|--------|-------|
| Admin production maps show Carto **"API KEY REQUIRED"** watermark | Open | `NEXT_PUBLIC_GOOGLE_MAPS_*` not set on App Hosting; falls back to Leaflet + Carto tiles |
| Admin logo missing on some production hosts | Open | Verify `public/icons/tardadi-wordmark.png` is included in App Hosting bundle (`prepare-admin-apphosting.js`) |
| SMTP not configured | Open | Password reset returns server error until SMTP secrets are set |
| Cloud Run public invoker blocked by org policy | By design | Admin BFF uses service account to call API; browser must not call Cloud Functions directly |
| Minimal automated test coverage | Open | Only `tardadi_core` has substantive unit tests |
| No GitHub Actions before handoff PR | Fixed in handoff | See `.github/workflows/ci.yml` |
| Legacy task markdown (`TASKS-TODAY.md`) | Informational | See `docs/UNCERTAIN_FILES.md` |

## Documentation index

| Document | Purpose |
|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, BFF, auth, maps |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup and debugging |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deploy checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | Secrets, RBAC, rules, threat notes |
| [docs/API.md](docs/API.md) | HTTP API reference |
| [docs/FIRESTORE.md](docs/FIRESTORE.md) | Data model |
| [docs/UNCERTAIN_FILES.md](docs/UNCERTAIN_FILES.md) | Files not deleted pending review |
| [docs/SECRET_ROTATION_REQUIRED.md](docs/SECRET_ROTATION_REQUIRED.md) | Keys that may need rotation |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch, PR, and review rules |

## Mobile bundle IDs (do not change without release plan)

| App | iOS | Android |
|-----|-----|---------|
| Passenger | `com.tardadi.tardadiPassenger` | `com.tardadi.tardadi_passenger` |
| Driver | `com.tardadi.tardadiDriver` | `com.tardadi.tardadi_driver` |

## Support

Production support contact (configured in backend): **support@tardadi.com**

## License

See package-level LICENSE files. Root license not yet finalized (`packages/tardadi_core/LICENSE` is a placeholder).
