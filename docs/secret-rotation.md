# Secret Rotation Required

This document lists credentials that may be **exposed in git history** or are **committed in client configuration**. Removing them from the latest commit does **not** make them safe — **rotate and restrict** each item in Google Cloud / Firebase consoles.

> **Do not paste actual secret values in issues or PRs.**

## Items to review

| Item | Location | Type | Action |
|------|----------|------|--------|
| Firebase Web API keys | `apps/passenger/lib/firebase_options.dart`, `apps/driver/lib/firebase_options.dart` | Client API key (public embed) | **Restrict** in Google Cloud Console (iOS/Android app IDs, API restrictions). Rotate if unrestricted keys were publicized. |
| Firebase Web config in debug logs | Avoid logging full config | Client config | Audit CI/build logs |
| `JWT_SECRET` in local `.env.example` | Template placeholder only | Dev secret | Ensure production uses Secret Manager `ADMIN_JWT_SECRET` only |
| Admin passwords | Must never be in repo | Credential | If ever committed, force password reset via `create-admin-user.mjs` |
| Google Maps API keys | Should be in env only | Restricted API key | If committed, rotate keys and update App Hosting / `.env.local` |
| Service account JSON | Must not be in repo | Private key | If committed: delete key in IAM, create new SA, re-grant roles, **do not** rely on git delete alone |

## Rotation procedure (general)

1. **Create replacement** secret/key in Google Cloud / Firebase.
2. **Deploy** updated config to App Hosting, Functions secrets, and local `.env.example` docs (not values).
3. **Revoke** old key/secret.
4. **Verify** production: Admin health, login, maps, mobile app startup.
5. **Audit** git history access — assume old values may have been cloned.

## Firebase client API keys

These are designed to be embedded in mobile apps but must have:

- Application restrictions (bundle ID / package name)
- API restrictions (Firebase-only APIs)

Console: Google Cloud → APIs & Services → Credentials.

## Admin JWT secret

```bash
firebase functions:secrets:set ADMIN_JWT_SECRET --project trddk-54c45
firebase deploy --only functions --project trddk-54c45
```

Rotating JWT secret **invalidates all existing admin sessions** — plan maintenance window.

## SMTP credentials

If SMTP passwords were exposed:

1. Rotate mailbox/app password with email provider.
2. Update Secret Manager / Functions secrets.
3. Test password reset email end-to-end.

## When git history rewrite is needed

Prefer **rotation** over `git filter-repo` unless compliance requires history purge. If history rewrite is required, coordinate with all developers and force-push policy.

## Reporting

Contact **support@tardadi.com** if you believe live production secrets were exposed.
