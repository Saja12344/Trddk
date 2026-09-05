# Canonical production deployment

## Admin dashboard (`tardadi.com`)

| Item | Value |
|------|--------|
| **Canonical source** | `apps/admin/` |
| **Hosting** | Vercel project `tardadi-admin` |
| **Root directory** | `apps/admin` (see `apps/admin/.vercel/project.json`) |
| **Firebase project** | `trddk-54c45` |
| **API** | `https://us-central1-trddk-54c45.cloudfunctions.net/api` |

Deploy only from `apps/admin`:

```bash
cd apps/admin
npm run build
npx vercel --prod
```

## Not production canonical

- `apphosting-staging/` — staging/reference copy; do **not** deploy to `tardadi.com`
- Git commit alone does not deploy; Vercel uploads the working tree used at deploy time

## Pre-deploy guard

`npm run build` in `apps/admin` runs `apps/admin/validate-production.mjs` first.

## Vercel upload exclusions

Root `.vercelignore` must use `/firebase` (repo root only). A bare `firebase`
pattern also excludes `apps/admin/src/lib/firebase/` and breaks email login builds.
PNG exclusions must allow `apps/admin/public/**` so TRDDK icons deploy.

## Mobile apps

- Passenger: `apps/passenger/`
- Driver: `apps/driver/`

## Backend

- Firebase Functions: `firebase/functions/` → `trddk-54c45`
