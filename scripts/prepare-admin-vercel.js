/**
 * Vendor @tardadi/shared into apps/admin for Vercel (Root Directory: apps/admin).
 * Requires monorepo root + packages/shared (enable "Include source files outside Root Directory" on Vercel).
 */
const { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } = require("fs");
const { join, resolve } = require("path");
const { execSync } = require("child_process");

const root = resolve(__dirname, "..");
const sharedSrc = join(root, "packages/shared");
const adminDir = join(root, "apps/admin");
const vendorDir = join(adminDir, "vendor/@tardadi/shared");

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
  throw new Error("Shared package build missing after vendoring.");
}

console.log("Prepared apps/admin/vendor/@tardadi/shared for Vercel.");
