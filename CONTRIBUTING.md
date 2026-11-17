# Contributing to TRDDK

Thank you for contributing. This monorepo contains Flutter mobile apps, a Next.js admin panel, and Firebase backend code.

## Branch workflow

`main` is the stable production branch. Do not commit feature work directly to it.

Create a branch from an updated `main`:

```bash
git checkout main && git pull
git checkout -b feature/passenger-reminders
```

Names:

| Pattern | Use |
|---------|-----|
| `feature/<app>-<short-desc>` | New behavior. Example: `feature/passenger-reminders` |
| `fix/<app>-<short-desc>` | A bug fix |
| `chore/<desc>` | Tooling, dependencies, or repo maintenance |
| `docs/<desc>` | Documentation only |

`<app>` is one of `admin`, `driver`, `passenger`, `backend`, or `shared`.

Do not put a tool name or a person's name in a branch name.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(passenger): add route reminders
fix(admin): keep the session cookie on refresh
chore: remove tracked tsbuildinfo
docs: update the deploy checklist
```

Keep commits focused. Avoid single massive commits mixing unrelated changes.

## Pull requests

Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`).

Checklist before requesting review:

- [ ] Branch is up to date with `main`
- [ ] No secrets, `.env.local`, or service account JSON in diff
- [ ] Tests/analyze run for affected apps (see below)
- [ ] Firebase project references remain `trddk-54c45` (not legacy projects)
- [ ] No `localhost` URLs in production config paths
- [ ] Documentation updated if behavior or env vars changed

## Tests required by area

| Area | Minimum verification |
|------|----------------------|
| Admin | `npm run typecheck` + `npm run build` in `apps/admin` |
| Functions | `npm run typecheck` + `npm run bundle` in `firebase/functions` |
| Shared TS | `npm run build:shared` |
| Flutter apps | `flutter analyze` + `flutter test` |
| `tardadi_core` | `flutter test` |

There is no GitHub Actions workflow in this branch yet. Run the checks in the table above locally.

## Secrets policy

- **Never** commit passwords, JWT secrets, SMTP credentials, or private keys.
- Use `.env.example` for documentation; real values in `.env.local` / Secret Manager.
- Firebase Web API keys may appear in client config — still restrict in Google Cloud Console.
- If you accidentally commit a secret: rotate it immediately and see [docs/secret-rotation.md](docs/secret-rotation.md).

## Code review focus

- Multi-tenant isolation (`businessId` scoping)
- Admin BFF allowlist for new proxy paths
- Firestore rules impact for client-readable collections
- iOS bundle IDs are registered in App Store Connect and cannot be changed. Android application IDs stay as they are unless a store listing update is planned.
- Backward compatibility for API response shapes used by mobile apps

## Do not change without migration plan

- Android `applicationId` / iOS bundle identifiers
- Firestore collection IDs or document field names consumed by production apps
- `@tardadi/shared` public types without updating all consumers

## Naming: TRDDK vs tardadi

- **TRDDK** — product name in user-facing docs and new markdown.
- **tardadi** — legacy identifiers in package names (`@tardadi/shared`) and paths. iOS bundle IDs are the App Store Connect values in the README, not names to invent or rename.

## Getting help

- Architecture: [docs/architecture.md](docs/architecture.md)
- Local setup: [docs/setup.md](docs/setup.md)
- Security: [docs/security.md](docs/security.md)

## License

Contributions are subject to project license terms (see package LICENSE files).
