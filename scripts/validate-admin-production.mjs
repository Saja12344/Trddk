#!/usr/bin/env node
/**
 * Fail production admin builds that reintroduce obsolete Tardadi branding,
 * phone-based admin login, or Leaflet-only maps without Google integration.
 */
import { readFileSync } from "fs";
import { join } from "path";

const ADMIN_ROOT = join(process.cwd());
const read = (rel) => readFileSync(join(ADMIN_ROOT, rel), "utf8");

const failures = [];

function forbid(rel, pattern, message) {
  const text = read(rel);
  if (pattern.test(text)) {
    failures.push(`${rel}: ${message}`);
  }
}

function requireMatch(rel, pattern, message) {
  const text = read(rel);
  if (!pattern.test(text)) {
    failures.push(`${rel}: ${message}`);
  }
}

// Branding — production admin must use TRDDK wordmark component.
forbid("src/app/layout.tsx", /ترددي/, "Arabic Tardadi title must not appear");
forbid("public/manifest.json", /ترددي/, "Arabic Tardadi manifest name must not appear");
forbid(
  "src/components/AdminShell.tsx",
  /tardadi-wordmark\.png/,
  "Old Tardadi wordmark asset must not be used in sidebar"
);
requireMatch(
  "src/components/AdminShell.tsx",
  /TrddkWordmark/,
  "Sidebar must render TrddkWordmark"
);

// Admin authentication — email/password + Firebase, not legacy phone login.
const login = read("src/app/login/page.tsx");
if (/JSON\.stringify\(\{\s*phone/.test(login)) {
  failures.push("src/app/login/page.tsx: legacy phone admin login detected");
}
if (!/firebaseSignIn|type=\"email\"|email/.test(login)) {
  failures.push("src/app/login/page.tsx: approved email login flow missing");
}

// Maps — canonical admin must keep Google Maps integration path.
requireMatch(
  "src/components/MapView.tsx",
  /isGoogleMapsEnabled/,
  "MapView must support approved Google dark map path"
);
requireMatch(
  "src/components/RouteMapEditor.tsx",
  /isGoogleMapsEnabled/,
  "RouteMapEditor must support approved Google dark map path"
);

if (failures.length > 0) {
  console.error("Admin production validation failed:\n");
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log("Admin production validation passed.");
