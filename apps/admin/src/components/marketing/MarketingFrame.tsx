import Link from "next/link";
import { marketingCopy, type MarketingLocale } from "@/lib/marketingCopy";
import { siteConfig } from "@/lib/siteConfig";

export default function MarketingFrame({
  locale,
  children,
}: {
  locale: MarketingLocale;
  children: React.ReactNode;
}) {
  const t = marketingCopy[locale];
  const home = locale === "en" ? "/en" : "/";
  const appsHref = `${home === "/" ? "" : home}#apps`;
  const ecoHref = `${home === "/" ? "" : home}#ecosystem`;
  const companiesHref = `${home === "/" ? "" : home}#contact`;
  const faqHref = `${home === "/" ? "" : home}#faq`;

  return (
    <div className="mkt" data-locale={locale}>
      <noscript>
        <style>{`.mkt-reveal{opacity:1;transform:none}`}</style>
      </noscript>
      <a className="mkt-skip" href="#content">
        {t.skipToContent}
      </a>
      <header className="mkt-nav">
        <Link href={home} className="mkt-brand" aria-label={t.altWordmark}>
          <img src={siteConfig.wordmark} alt={t.altWordmark} className="mkt-wordmark" width={156} height={45} />
          <img src={siteConfig.logo} alt="" className="mkt-bus" width={38} height={32} />
        </Link>
        <nav className="mkt-links" aria-label="primary">
          <a href={ecoHref}>{t.navEcosystem}</a>
          <a href={appsHref}>{t.navApps}</a>
          <a href={companiesHref}>{t.navCompanies}</a>
          <a href={faqHref}>{t.navFaq}</a>
        </nav>
        <div className="mkt-actions">
          <Link href={t.otherLocaleHref} className="mkt-lang" hrefLang={locale === "ar" ? "en" : "ar-SA"}>
            {t.otherLocaleLabel}
          </Link>
          <Link href="/login" className="mkt-login">
            {t.login}
          </Link>
          <details className="mkt-menu">
            <summary>{t.menu}</summary>
            <div className="mkt-menu-panel">
              <a href={ecoHref}>{t.navEcosystem}</a>
              <a href={appsHref}>{t.navApps}</a>
              <a href={companiesHref}>{t.navCompanies}</a>
              <a href={faqHref}>{t.navFaq}</a>
              <Link href="/login">{t.login}</Link>
            </div>
          </details>
        </div>
      </header>
      {children}
      <footer className="mkt-shell mkt-tone-footer">
        <div className="mkt-wrap mkt-footer">
        <div className="mkt-footer-grid">
          <div>
            <div className="mkt-footer-brand">
              <img src={siteConfig.logo} alt="" width={36} height={30} />
              <span>TRDDK</span>
            </div>
            <p className="mkt-footer-tag">{t.footerTag}</p>
            <p>{t.footerNote}</p>
          </div>
          <div>
            <p className="mkt-footer-heading">{t.footerNav}</p>
            <a href={ecoHref}>{t.navEcosystem}</a>
            <a href={companiesHref}>{t.navCompanies}</a>
            <a href={faqHref}>{t.navFaq}</a>
            <Link href="/login">{t.footerAdmin}</Link>
          </div>
          <div>
            <p className="mkt-footer-heading">{t.footerApps}</p>
            <a href={appsHref}>{t.passengerTitle}</a>
            <a href={appsHref}>{t.driverTitle}</a>
          </div>
          <div>
            <p className="mkt-footer-heading">{t.footerLegal}</p>
            <Link href={t.privacy.path}>{t.footerPrivacy}</Link>
            <Link href={t.terms.path}>{t.footerTerms}</Link>
          </div>
        </div>
        </div>
      </footer>
    </div>
  );
}
