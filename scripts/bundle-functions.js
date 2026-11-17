/**
 * Bundle Cloud Functions for Firebase deploy (includes @tardadi/shared).
 */
const { build } = require("esbuild");
const { resolve } = require("path");

async function main() {
  await build({
    entryPoints: [resolve(__dirname, "../firebase/functions/src/index.ts")],
    outfile: resolve(__dirname, "../firebase/functions/dist/bundle.js"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: true,
    external: [
      "firebase-admin",
      "firebase-functions",
      "express",
      "cors",
      "nodemailer",
    ],
    logLevel: "info",
  });
  console.log("Bundled Cloud Functions entrypoint.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
