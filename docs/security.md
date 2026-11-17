# Security

## Threat model (summary)

ترددك (Trddk) handles business operations data (routes, drivers, live GPS). Primary risks:

- Unauthorized admin access across businesses
- Leaked JWT or service account credentials
- Direct public invocation of Cloud Run API bypassing BFF controls
- Over-permissive Firestore client rules
- Exposed SMTP or admin passwords

## Secrets storage

| Secret | Where | Never |
|--------|-------|-------|
| `ADMIN_JWT_SECRET` | Secret Manager (Functions) | Git, client env |
| SMTP credentials | Secret Manager / env | Git, client |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | App Hosting attached SA preferred | Commit to repo |
| Admin passwords | Firestore `passwordHash` only | Plaintext anywhere |
| Firebase Web API keys | Client config (public) | Treat as **restricted**, not secret |

See [secret-rotation.md](secret-rotation.md) for rotation notes.

## Admin authentication

- Login: `POST /api/auth/admin-login` (via BFF `POST /api/auth/login`).
- Password hashing: scrypt (`firebase/functions/src/auth/crypto.ts`).
- Session: HTTP-only cookie on Admin host; JWT sent to backend as `X-Tardadi-Admin-Token`.
- Password reset: token collection `password_reset_tokens` (Admin SDK only); email via SMTP when configured.
- Rate limiting on auth endpoints (`src/auth/rateLimit.ts`).

## Roles

| Role | Capabilities |
|------|--------------|
| `super_admin` | All businesses CRUD, admin users |
| `business_admin` | Single `businessId` resources |
| Driver token | Driver-scoped API routes |

RBAC: `packages/shared/src/rbac.ts`, enforced in Functions middleware.

## Business isolation

- Data paths: `businesses/{businessId}/…`
- Business admin JWT includes `businessId`; middleware rejects cross-tenant access.
- Super admin may impersonate context via Admin UI business switcher (cookie `BUSINESS_CONTEXT_COOKIE`).

## Admin BFF / proxy

- Browser calls `/api/proxy/*` only for backend resources.
- Allowlist: `ADMIN_PROXY_ALLOWLIST` in `apps/admin/src/lib/env.server.ts`.
- Server-side `fetchBackend()` adds Cloud Run identity token when running on GCP.
- Do **not** expose Cloud Functions URL + admin JWT to browser for arbitrary calls.

## Cloud Run invoker

Production API runs as Gen2 Cloud Function (`api`) backed by Cloud Run.

- **Org policy** may block `allUsers` / `allAuthenticatedUsers` invoker bindings.
- Expected pattern: only service accounts (Admin BFF SA, Cloud Functions SA) have `roles/run.invoker`.
- Removing org policy is **not** required if BFF auth works.

Verify invokers in Cloud Console → Cloud Run → `api` → Permissions.

## Firestore security rules

File: `firebase/firestore.rules`

- Client reads on routes/buses/trips are broadly open for passenger map use cases.
- Writes require super admin or matching business admin.
- `admin_users` readable/writable by super admin only.
- Sensitive collections (`password_reset_tokens`) are **not** in rules — Admin SDK only.

Review rule changes with multi-tenant scenarios before deploy.

## CORS

Functions use `cors` middleware. Admin BFF same-origin avoids browser CORS to Cloud Functions for most admin operations.

## API keys

- **Firebase Web API keys** in `firebase_options.dart` / `NEXT_PUBLIC_*` are embeddable — restrict by app ID / referrer in Google Cloud Console.
- **Google Maps keys:** separate browser vs server keys; restrict APIs and referrers.
- API keys are **not** authentication — always pair with Firebase Auth, JWT, or IAM as designed.

## Password reset

1. User requests reset → `POST /api/auth/request-password-reset`
2. Token stored hashed in Firestore
3. Email sent if SMTP configured with link to `ADMIN_PUBLIC_URL/reset-password?token=…`
4. Without SMTP, flow fails safely (no token leak in response)

## FCM / APNs

- FCM server keys managed by Firebase; client registers tokens.
- iOS requires APNs key/certificate in Firebase project settings.
- Treat device tokens as sensitive identifiers.

## Dependency hygiene

- Run `npm audit` / `flutter pub outdated` periodically.
- CI runs analyze/build on PRs (see `.github/workflows/ci.yml`).

## Reporting vulnerabilities

Email **support@tardadi.com** with:

- Description and impact
- Reproduction steps (no production passwords)
- Affected component (admin / driver / passenger / API)

Do not open public GitHub issues for undisclosed security bugs.

## Related

- `apps/admin/SECURITY.md` — Admin-specific BFF notes (may drift; prefer this doc)
- [architecture.md](architecture.md)
- [deployment.md](deployment.md)
