import { createHash } from "crypto";
import { db } from "../firebase";

/**
 * Automatic Arabic <-> English names for routes, stations and places.
 *
 * Admins type names in one language (usually Arabic). When the apps ask for
 * routes, we add `nameAr` / `nameEn` (and `addressAr` / `addressEn` for the
 * start/end places) using Google Cloud Translation. Every translation is
 * cached in Firestore (`translations`), so each text is translated only once.
 *
 * Never throws: if translation is unavailable the original text is used.
 *
 * Auth: the Cloud Functions service account (no key needed) once the
 * "Cloud Translation API" is enabled on the project. Optionally set the
 * GOOGLE_TRANSLATE_API_KEY env var instead.
 */

const CACHE_COLLECTION = "translations";
const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const TIMEOUT_MS = 3000;
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

export interface NamePair {
  ar: string;
  en: string;
}

const memoryCache = new Map<string, NamePair>();

function cacheKey(text: string): string {
  return createHash("sha1").update(text.trim()).digest("hex");
}

export function isArabicText(text: string): boolean {
  return ARABIC_RE.test(text);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function serviceAccountToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(1500),
      }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;
    cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 300) * 1000,
    };
    return cachedToken.value;
  } catch {
    return null; // Not on Google Cloud (e.g. local emulator).
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function callTranslate(
  texts: string[],
  source: "ar" | "en",
  target: "ar" | "en"
): Promise<string[] | null> {
  if (texts.length === 0) return [];
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url = TRANSLATE_URL;
  if (apiKey) {
    url += `?key=${encodeURIComponent(apiKey)}`;
  } else {
    const token = await serviceAccountToken();
    if (!token) return null;
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ q: texts, source, target, format: "text" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("translate failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const body = (await res.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    const out = body.data?.translations ?? [];
    if (out.length !== texts.length) return null;
    return out.map((t, i) => decodeEntities(t.translatedText ?? texts[i]));
  } catch (error) {
    console.warn("translate error", (error as Error).message);
    return null;
  }
}

/** Returns an {ar, en} pair for every input text (original text as fallback). */
export async function translateNames(
  inputs: Iterable<string | null | undefined>
): Promise<Map<string, NamePair>> {
  const result = new Map<string, NamePair>();
  const unique = [
    ...new Set(
      [...inputs]
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0)
    ),
  ];
  if (unique.length === 0) return result;

  const missing: string[] = [];
  for (const text of unique) {
    const hit = memoryCache.get(text);
    if (hit) result.set(text, hit);
    else missing.push(text);
  }

  // Firestore cache.
  if (missing.length > 0) {
    try {
      const refs = missing.map((t) => db.collection(CACHE_COLLECTION).doc(cacheKey(t)));
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap, i) => {
        const data = snap.data() as Partial<NamePair> | undefined;
        if (snap.exists && data?.ar && data?.en) {
          const pair = { ar: data.ar, en: data.en };
          memoryCache.set(missing[i], pair);
          result.set(missing[i], pair);
        }
      });
    } catch (error) {
      console.warn("translation cache read failed", (error as Error).message);
    }
  }

  const toTranslate = missing.filter((t) => !result.has(t));
  if (toTranslate.length > 0) {
    const arabic = toTranslate.filter(isArabicText);
    const english = toTranslate.filter((t) => !isArabicText(t));
    const [toEn, toAr] = await Promise.all([
      callTranslate(arabic, "ar", "en"),
      callTranslate(english, "en", "ar"),
    ]);

    const fresh: Array<[string, NamePair]> = [];
    arabic.forEach((text, i) => {
      if (toEn) fresh.push([text, { ar: text, en: toEn[i] }]);
    });
    english.forEach((text, i) => {
      if (toAr) fresh.push([text, { ar: toAr[i], en: text }]);
    });

    if (fresh.length > 0) {
      const batch = db.batch();
      for (const [text, pair] of fresh) {
        memoryCache.set(text, pair);
        result.set(text, pair);
        batch.set(db.collection(CACHE_COLLECTION).doc(cacheKey(text)), {
          text,
          ...pair,
          updatedAt: new Date().toISOString(),
        });
      }
      await batch.commit().catch((error: Error) => {
        console.warn("translation cache write failed", error.message);
      });
    }
  }

  // Fallback: untranslated text is used as-is for both languages.
  for (const text of unique) {
    if (!result.has(text)) result.set(text, { ar: text, en: text });
  }
  return result;
}

type Named = Record<string, unknown>;

function nameTexts(item: Named): string[] {
  const out: string[] = [];
  if (typeof item.name === "string") out.push(item.name);
  for (const key of ["fromLocation", "toLocation"]) {
    const place = item[key] as Named | undefined;
    if (place && typeof place.address === "string") out.push(place.address);
  }
  return out;
}

function applyNames(item: Named, names: Map<string, NamePair>): Named {
  const next: Named = { ...item };
  if (typeof item.name === "string" && item.name.trim()) {
    const pair = names.get(item.name.trim());
    if (pair) {
      // Values typed by an admin always win over machine translation.
      next.nameAr = (item.nameAr as string | undefined) || pair.ar;
      next.nameEn = (item.nameEn as string | undefined) || pair.en;
    }
  }
  for (const key of ["fromLocation", "toLocation"]) {
    const place = item[key] as Named | undefined;
    if (place && typeof place.address === "string" && place.address.trim()) {
      const pair = names.get(place.address.trim());
      if (pair) {
        next[key] = {
          ...place,
          addressAr: (place.addressAr as string | undefined) || pair.ar,
          addressEn: (place.addressEn as string | undefined) || pair.en,
        };
      }
    }
  }
  return next;
}

/** Adds nameAr/nameEn (and addressAr/addressEn) to routes or stops. */
export async function withTranslatedNames<T extends Named>(items: T[]): Promise<T[]> {
  try {
    const names = await translateNames(items.flatMap(nameTexts));
    return items.map((item) => applyNames(item, names) as T);
  } catch (error) {
    console.warn("withTranslatedNames failed", (error as Error).message);
    return items;
  }
}
