/**
 * Prepare a self-contained App Hosting staging tree with vendored @tardadi/shared.
 * Uses `pkg/` (not `dist/`) so gitignore does not strip compiled output from upload zips.
 */
const { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } = require("fs");
const { join, resolve } = require("path");
const { execSync } = require("child_process");

const root = resolve(__dirname, "..");
const sharedSrc = join(root, "packages/shared");
const adminDir = join(root, "apps/admin");
const vendorDir = join(adminDir, "vendor/@tardadi/shared");
const stagingDir = join(root, "apphosting-staging");

execSync("npm run build -w @tardadi/shared", { cwd: root, stdio: "inherit" });

rmSync(vendorDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
cpSync(join(sharedSrc, "dist"), join(vendorDir, "pkg"), { recursive: true });

const vendorPackageJson = {
  name: "@tardadi/shared",
  version: "0.1.0",
  private: true,
  main: "./pkg/index.js",
  types: "./pkg/index.d.ts",
  exports: {
    ".": {
      types: "./pkg/index.d.ts",
      default: "./pkg/index.js",
    },
  },
};
writeFileSync(
  join(vendorDir, "package.json"),
  `${JSON.stringify(vendorPackageJson, null, 2)}\n`
);

if (!existsSync(join(vendorDir, "pkg/index.js"))) {
  throw new Error("Shared package build missing");
}

execSync("npm install --workspaces=false", {
  cwd: adminDir,
  stdio: "inherit",
});

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

for (const entry of [
  "src",
  "public",
  "vendor",
  "apphosting.yaml",
  "next.config.ts",
  "next-env.d.ts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
]) {
  const srcPath = join(adminDir, entry);
  if (existsSync(srcPath)) {
    cpSync(srcPath, join(stagingDir, entry), { recursive: true });
  }
}

console.log("Prepared admin App Hosting staging bundle.");

const stagingFirebaseJson = {
  apphosting: {
    backendId: "tardadi-admin",
    rootDir: ".",
    alwaysDeployFromSource: true,
  },
};
writeFileSync(
  join(stagingDir, "firebase.json"),
  `${JSON.stringify(stagingFirebaseJson, null, 2)}\n`
);
