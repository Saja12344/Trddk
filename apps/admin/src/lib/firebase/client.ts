"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

import { getFirebaseWebConfig } from "./config";

let app: FirebaseApp | null = null;

/** Lazily initialize Firebase client SDK once (safe for Next.js hot reload). */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0]!;
    return app;
  }

  const config = getFirebaseWebConfig();
  if (!config) {
    return null;
  }

  app = initializeApp(config);
  return app;
}
