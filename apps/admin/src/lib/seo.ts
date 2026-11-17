import type { Metadata } from "next";
import { SITE_URL, siteConfig } from "@/lib/siteConfig";
import { marketingCopy, type MarketingLocale } from "@/lib/marketingCopy";

const OG = {
  url: siteConfig.ogImage,
  width: 1200,
  height: 630,
  alt: "TRDDK",
};

export function absoluteUrl(path: string): string {
  if (path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path}`;
}

export function languageAlternates(arPath: string, enPath: string) {
  return {
    "ar-SA": absoluteUrl(arPath),
    ar: absoluteUrl(arPath),
    en: absoluteUrl(enPath),
    "x-default": absoluteUrl(arPath),
  };
}

export function marketingMetadata(locale: MarketingLocale): Metadata {
  const t = marketingCopy[locale];
  const canonical = absoluteUrl(t.canonicalPath);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    keywords: [...t.keywords],
    alternates: {
      canonical,
      languages: languageAlternates("/", "/en"),
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "TRDDK",
      locale: t.ogLocale,
      title: t.metaTitle,
      description: t.metaDescription,
      images: [OG],
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
      images: [OG.url],
    },
    robots: { index: true, follow: true },
  };
}

export function legalMetadata(
  locale: MarketingLocale,
  page: "privacy" | "terms"
): Metadata {
  const t = marketingCopy[locale];
  const copy = t[page];
  const canonical = absoluteUrl(copy.path);
  const arPath = page === "privacy" ? "/privacy" : "/terms";
  const enPath = page === "privacy" ? "/en/privacy" : "/en/terms";
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: {
      canonical,
      languages: languageAlternates(arPath, enPath),
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "TRDDK",
      locale: t.ogLocale,
      title: copy.metaTitle,
      description: copy.metaDescription,
      images: [OG],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.metaTitle,
      description: copy.metaDescription,
      images: [OG.url],
    },
    robots: { index: true, follow: true },
  };
}

export const noIndexMetadata: Metadata = {
  title: "TRDDK",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};
