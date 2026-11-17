export const SITE_URL = "https://www.tardadi.com";

/**
 * Public site configuration. Store URLs stay null until a live listing exists.
 *
 * Optional env:
 * - NEXT_PUBLIC_TRDDK_CONTACT_EMAIL — overrides the public contact address
 * - GOOGLE_SITE_VERIFICATION — Search Console HTML-tag token (server)
 */
export const siteConfig = {
  name: "TRDDK",
  alternateName: "ترددك",
  url: SITE_URL,
  ogImage: "/marketing/og.jpg",
  logo: "/icons/tardadi-bus-mark.png",
  wordmark: "/icons/trddk-wordmark.png",
  contactEmail: process.env.NEXT_PUBLIC_TRDDK_CONTACT_EMAIL || "support@tardadi.com",
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION || null,
} as const;
