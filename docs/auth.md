# TRDDK Firebase Authentication Migration

This document describes the transition from legacy Admin JWT + phone/OTP flows to **Firebase Authentication (Email/Password)** for all roles.

## Legacy system (kept during migration)

| Component | Location | Notes |
|-----------|----------|-------|
| Admin JWT (HS256) | `firebase/functions/src/auth/crypto.ts` | `ADMIN_JWT_SECRET` |
| Admin login (phone) | `POST /api/auth/admin-login` | Queries `admin_users` by phone |
| Admin BFF cookie | `apps/admin/src/app/api/auth/login/route.ts` | `tardadi_admin_session` |
| SMTP mailer | `firebase/functions/src/auth/mail.ts` | **Not wired** to routes |
| Driver OTP | `apps/driver/lib/screens/login_screen.dart` | Demo code `000000` |
| Passenger OTP | Local session, no backend auth | Demo IDs |

## New system

| Component | Location |
|-----------|----------|
| Shared auth types | `packages/shared/src/auth.ts` |
| Firebase token verify | `firebase/functions/src/auth/firebaseAuth.ts` |
| Dual middleware | `firebase/functions/src/auth/middleware.ts` |
| User service (invite, bulk) | `firebase/functions/src/services/users.ts` |
| Firebase session | `POST /api/auth/firebase-session` |
| App session (mobile) | `POST /api/auth/firebase-app-session` |
| User management | `POST /api/users/invite`, bulk import endpoints |
| Admin login UI | Email/password via Firebase client SDK |
| Password reset | `sendPasswordResetEmail` (no SMTP) |
| Firestore profiles | `users/{uid}`, `users/{uid}/memberships/{businessId}` |

## Firebase Console checklist (`trddk-54c45`)

1. **Authentication → Sign-in method**: Enable **Email/Password**
2. **Authentication → Templates**: Customize Password reset & Email verification (Arabic/English, brand **TRDDK**)
3. **Authentication → Settings → Authorized domains**:
   - `localhost`
   - `tardadi-admin--trddk-54c45.us-central1.hosted.app`
   - Production admin domain when ready
4. **Authentication → Settings → Action URL**: Point to admin `/login` or dedicated reset handler
5. Set Cloud Functions env: `FIREBASE_WEB_API_KEY` (Web API key for OOB email from backend invites)
6. Optional custom email domain DNS (if using `@trddk.com`):
   - SPF: `v=spf1 include:_spf.firebasemail.com ~all`
   - DKIM: records from Firebase Console → Authentication → Templates

## Roles & data model

```
users/{uid}
  email, displayName, primaryRole, status, createdAt, createdBy, lastLoginAt

users/{uid}/memberships/{businessId}
  role, status, joinedAt, source, employeeNumber, department
```

Custom Claims (static): `role`, `businessId`, `status` — synced on invite/login.  
Memberships (dynamic): source of truth for business isolation.

## Migration steps

1. `DRY_RUN=1 node scripts/migrate-admin-to-firebase.mjs` — inventory
2. Set real email for Lama (super_admin): `LAMA_EMAIL=... node scripts/setup-super-admin.mjs`
3. Run migration without `DRY_RUN` (all admins): `node scripts/migrate-admin-to-firebase.mjs`
4. Password setup links sent automatically (Firebase OOB; set `FIREBASE_WEB_API_KEY`, or `SKIP_EMAIL=1`)
5. Test Firebase login on staging
6. Keep legacy phone login toggle until all admins migrated
7. Remove legacy JWT + SMTP + OTP only after test checklist passes

## Manual steps remaining

- [ ] Enable Email/Password in Firebase Console
- [ ] Set `NEXT_PUBLIC_FIREBASE_*` on Admin App Hosting
- [ ] Set `FIREBASE_WEB_API_KEY` on Cloud Functions
- [ ] Migrate Lama account to real email (not in git)
- [ ] Configure email templates (AR/EN)
- [ ] Run emulator rules tests
- [ ] End-to-end tests on staging before production deploy

## Test checklist

See user spec section 17 — all items must pass on staging before production.

## SMTP / OTP status

- **SMTP**: Code remains in repo but unused by new flows. Remove after migration sign-off.
- **OTP**: Driver/Passenger OTP remains until mobile Firebase auth is completed and tested.
