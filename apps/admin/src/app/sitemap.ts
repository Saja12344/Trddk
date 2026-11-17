import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { "ar-SA": `${SITE_URL}/`, en: `${SITE_URL}/en` } },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: { "ar-SA": `${SITE_URL}/`, en: `${SITE_URL}/en` } },
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: { languages: { "ar-SA": `${SITE_URL}/privacy`, en: `${SITE_URL}/en/privacy` } },
    },
    {
      url: `${SITE_URL}/en/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: { languages: { "ar-SA": `${SITE_URL}/privacy`, en: `${SITE_URL}/en/privacy` } },
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: { languages: { "ar-SA": `${SITE_URL}/terms`, en: `${SITE_URL}/en/terms` } },
    },
    {
      url: `${SITE_URL}/en/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: { languages: { "ar-SA": `${SITE_URL}/terms`, en: `${SITE_URL}/en/terms` } },
    },
  ];
}
