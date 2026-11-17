import { marketingCopy, type MarketingLocale } from "@/lib/marketingCopy";
import { SITE_URL } from "@/lib/siteConfig";
import { absoluteUrl } from "@/lib/seo";
import MarketingFrame from "@/components/marketing/MarketingFrame";

export default function LegalPage({
  locale,
  page,
}: {
  locale: MarketingLocale;
  page: "privacy" | "terms";
}) {
  const t = marketingCopy[locale];
  const copy = t[page];
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "TRDDK",
        item: absoluteUrl(t.canonicalPath),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: copy.title,
        item: `${SITE_URL}${copy.path}`,
      },
    ],
  };

  return (
    <MarketingFrame locale={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
      />
      <main id="content" className="mkt-shell mkt-tone-hero">
        <div className="mkt-wrap mkt-legal">
        <p className="mkt-kicker">TRDDK</p>
        <h1>{copy.title}</h1>
        <p className="mkt-legal-updated">{copy.updated}</p>
        {copy.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        </div>
      </main>
    </MarketingFrame>
  );
}
