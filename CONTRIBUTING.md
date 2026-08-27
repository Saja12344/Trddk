# Contributing to TRDDK

Thank you for contributing. This monorepo contains Flutter mobile apps, a Next.js admin panel, and Firebase backend code.

## Branch workflow

1. **Do not commit directly to `main`** for feature work.
2. Create a branch from updated `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/short-description
   ```
3. Use prefixes:
   - `feature/` — new functionality
   - `fix/` — bug fixes
   - `docs/` — documentation only
   - `chore/` — tooling, deps, CI
   - `refactor/` — no behavior change

## Commits

Prefer [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(admin): add business export
fix(functions): validate trip start payload
docs: update deployment checklist
chore: remove tracked tsbuildinfo
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

CI runs a subset on every PR (`.github/workflows/ci.yml`).

## Secrets policy

- **Never** commit passwords, JWT secrets, SMTP credentials, or private keys.
- Use `.env.example` for documentation; real values in `.env.local` / Secret Manager.
- Firebase Web API keys may appear in client config — still restrict in Google Cloud Console.
- If you accidentally commit a secret: rotate it immediately and see [docs/SECRET_ROTATION_REQUIRED.md](docs/SECRET_ROTATION_REQUIRED.md).

## Code review focus

- Multi-tenant isolation (`businessId` scoping)
- Admin BFF allowlist for new proxy paths
- Firestore rules impact for client-readable collections
- Mobile bundle IDs unchanged unless explicitly planned
- Backward compatibility for API response shapes used by mobile apps

## Do not change without migration plan

- Android `applicationId` / iOS bundle identifiers
- Firestore collection IDs or document field names consumed by production apps
- `@tardadi/shared` public types without updating all consumers

## Naming: TRDDK vs tardadi

- **TRDDK** — product name in user-facing docs and new markdown.
- **tardadi** — legacy identifiers in package names (`@tardadi/shared`), paths, and mobile bundle IDs. Keep for compatibility.

## Getting help

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Local setup: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Security: [docs/SECURITY.md](docs/SECURITY.md)

## License

Contributions are subject to project license terms (see package LICENSE files).
