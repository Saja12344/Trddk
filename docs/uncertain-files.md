# Uncertain files

These files were kept because their purpose is still unclear. Do not delete them until someone confirms they are unused.

| Path | Likely purpose | Why it is still here |
|------|----------------|----------------------|
| `scripts/create-admin-user.ts` | Create a super admin with Firebase Admin SDK | Overlaps `scripts/create-admin-user.mjs`. Neither is the only documented path. |
| `scripts/create-admin-user.mjs` | Create a super admin with a Firebase CLI token | Overlaps the TypeScript script. See [deployment.md](deployment.md). |
| `scripts/prepare-functions-deploy.js` | Vendor the shared package for Functions deploy | May overlap `bundle-functions.js`. Deploy hooks still need a check. |
| `firebase/hosting/public/` | Static placeholder for Firebase Hosting | `firebase.json` still points at hosting, and this is not the admin UI. |
| `apps/admin/vendor/@tardadi/shared/` | Vendored shared package used by the admin app | The directory is gitignored for new files, but the current build output is already tracked. |
| `firebase/functions/vendor/@tardadi/shared/` | Vendored shared package for the functions build | Generated output. `dist/` is gitignored. |
| `.apphostingignore` | Exclude paths from an App Hosting upload | Still referenced by Firebase deploy config. |
| `.vercelignore` and `apps/admin/.vercelignore` | Vercel upload rules | Production admin hosting is still described as Vercel in [canonical-deployment.md](canonical-deployment.md). |
| `apps/passenger/assets/videos/tardadi-icon-alpha.mov` | Brand splash video | Large binary. Confirm the splash still plays this file before removing it. |
| `packages/tardadi_core/LICENSE` | Placeholder license | Replace it when the project license is decided. |
| `apps/driver/{linux,macos,windows}` and `apps/passenger/{linux,macos,windows}` | Flutter desktop shells | Not deleted. Confirm whether desktop targets are in scope. |
| `apps/passenger/lib/debug/startup_timeline.dart` | Temporary startup logs | Imported by the splash and home screens. Remove it only together with those imports. |
| `apps/passenger/android/app/src/main/res/drawable/splash_logo.png` | Hi-res Android splash bitmap | The current launch XML does not reference it. Kept because the hi-res splash art was restored on purpose. |
