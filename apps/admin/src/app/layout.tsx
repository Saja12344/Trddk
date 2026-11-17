import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { headers } from "next/headers";
import { SITE_URL, siteConfig } from "@/lib/siteConfig";
import "./globals.css";
import "./marketing.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TRDDK",
    template: "%s",
  },
  description:
    "TRDDK bus tracking — passenger, driver, and company admin on tardadi.com",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-orange-only.svg", type: "image/svg+xml" },
      { url: "/favicon-orange-only.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/tardadi-bus-orange-only-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/tardadi-bus-orange-only-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-orange-only.png", sizes: "180x180", type: "image/png" }],
  },
  ...(siteConfig.googleSiteVerification
    ? { verification: { google: siteConfig.googleSiteVerification } }
    : {}),
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-trddk-locale") === "en" ? "en" : "ar";
  return (
    <html
      lang={locale === "en" ? "en" : "ar-SA"}
      dir={locale === "en" ? "ltr" : "rtl"}
      className={`${plex.variable} ${plexAr.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
