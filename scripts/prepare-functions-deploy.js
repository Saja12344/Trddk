/**
 * Bundle workspace @tardadi/shared into functions before Firebase deploy.
 * Cloud Build has no npm workspace — point @tardadi/shared at the vendored copy.
 */
const { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } =
  require("fs");
const { join, resolve } = require("path");

const root = resolve(__dirname, "..");
const sharedSrc = join(root, "packages/shared");
const functionsDir = join(root, "firebase/functions");
const target = join(functionsDir, "vendor/@tardadi/shared");
const functionsPkgPath = join(functionsDir, "package.json");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(sharedSrc, "dist"), join(target, "dist"), { recursive: true });
cpSync(join(sharedSrc, "package.json"), join(target, "package.json"));

if (!existsSync(join(target, "dist/index.js"))) {
  console.error("Missing @tardadi/shared build. Run: npm run build:shared");
  process.exit(1);
}

const functionsPkg = JSON.parse(readFileSync(functionsPkgPath, "utf8"));
functionsPkg.dependencies["@tardadi/shared"] = "file:./vendor/@tardadi/shared";
writeFileSync(functionsPkgPath, `${JSON.stringify(functionsPkg, null, 2)}\n`);

console.log("Prepared @tardadi/shared for Cloud Functions deploy.");
