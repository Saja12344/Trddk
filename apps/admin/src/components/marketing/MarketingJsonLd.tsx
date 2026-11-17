import { SITE_URL, siteConfig } from "@/lib/siteConfig";
import { marketingCopy, type MarketingLocale } from "@/lib/marketingCopy";
import { absoluteUrl } from "@/lib/seo";
import { appDistribution, storeIsLive } from "@/lib/appDistribution";

export default function MarketingJsonLd({ locale }: { locale: MarketingLocale }) {
  const t = marketingCopy[locale];
  const pageUrl = absoluteUrl(t.canonicalPath);
  const passengerIos = appDistribution.passenger.ios;
  const passengerAndroid = appDistribution.passenger.android;
  const driverIos = appDistribution.driver.ios;
  const driverAndroid = appDistribution.driver.android;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "TRDDK",
      alternateName: "ترددك",
      url: SITE_URL,
      logo: absoluteUrl(siteConfig.logo),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "TRDDK",
      alternateName: "ترددك",
      inLanguage: ["ar-SA", "en"],
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: t.metaTitle,
      description: t.metaDescription,
      inLanguage: t.htmlLang,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "VideoObject",
      name: "TRDDK",
      description: t.heroVideoAlt,
      thumbnailUrl: absoluteUrl("/marketing/trddk-poster.jpg"),
      contentUrl: absoluteUrl("/marketing/trddk.mp4"),
      uploadDate: "2026-10-20",
      inLanguage: t.htmlLang,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      url: `${pageUrl}#faq`,
      inLanguage: t.htmlLang,
      mainEntity: t.faqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  const passengerUrls = [passengerIos, passengerAndroid]
    .filter(storeIsLive)
    .map((s) => s.url);
  const driverUrls = [driverIos, driverAndroid].filter(storeIsLive).map((s) => s.url);

  if (passengerUrls.length > 0) {
    graph.push({
      "@type": "SoftwareApplication",
      name: t.passengerAppName,
      applicationCategory: "TravelApplication",
      operatingSystem: "iOS, Android",
      url: passengerUrls[0],
      publisher: { "@id": `${SITE_URL}/#organization` },
    });
  }
  if (driverUrls.length > 0) {
    graph.push({
      "@type": "SoftwareApplication",
      name: t.driverAppName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "iOS, Android",
      url: driverUrls[0],
      publisher: { "@id": `${SITE_URL}/#organization` },
    });
  }

  const json = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
