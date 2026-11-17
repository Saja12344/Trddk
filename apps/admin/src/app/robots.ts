import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/en", "/privacy", "/terms", "/en/privacy", "/en/terms"],
        disallow: [
          "/dashboard",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/change-password",
          "/buses",
          "/routes",
          "/drivers",
          "/trips",
          "/beneficiaries",
          "/businesses",
          "/settings",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
