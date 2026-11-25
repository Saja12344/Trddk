import Link from "next/link";
import { marketingCopy, type MarketingLocale } from "@/lib/marketingCopy";
import { siteConfig } from "@/lib/siteConfig";
import MarketingFrame from "@/components/marketing/MarketingFrame";
import MarketingJsonLd from "@/components/marketing/MarketingJsonLd";
import StoreActions from "@/components/marketing/StoreActions";
import MarketingFilm from "@/components/marketing/MarketingFilm";
import MarketingReveal from "@/components/marketing/MarketingReveal";

function Shell({
  id,
  tone,
  children,
}: {
  id?: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`mkt-shell ${tone}`}>
      <div className="mkt-wrap">{children}</div>
    </section>
  );
}

function Glyph({ name }: { name: "bus" | "school" | "fleet" | "phone" | "wheel" | "board" | "map" | "route" | "pin" | "clock" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  return (
    <svg className="mkt-glyph" {...common}>
      {name === "bus" && (
        <>
          <rect x="4" y="5" width="16" height="12" rx="2.5" />
          <path d="M7 17v2M17 17v2M4 12h16" />
        </>
      )}
      {name === "school" && (
        <>
          <path d="M3 10 12 4l9 6" />
          <path d="M5 10v8h14v-8" />
          <path d="M10 18v-4h4v4" />
        </>
      )}
      {name === "fleet" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </>
      )}
      {name === "phone" && <rect x="7" y="3" width="10" height="18" rx="2" />}
      {name === "wheel" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
      {name === "board" && (
        <>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 20h8" />
        </>
      )}
      {name === "map" && (
        <>
          <path d="M9 4 3 6.5v13L9 17l6 2.5L21 17V4L15 6.5 9 4z" />
          <path d="M9 4v13M15 6.5v13" />
        </>
      )}
      {name === "route" && (
        <>
          <circle cx="6" cy="6" r="2.2" />
          <circle cx="18" cy="18" r="2.2" />
          <path d="M8 7.5c6 0 2 9 8 9" />
        </>
      )}
      {name === "pin" && (
        <>
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </>
      )}
    </svg>
  );
}

export default function MarketingSite({ locale }: { locale: MarketingLocale }) {
  const t = marketingCopy[locale];
  const mail = siteConfig.contactEmail;

  return (
    <MarketingFrame locale={locale}>
      <MarketingJsonLd locale={locale} />
      <main id="content">
        <Shell tone="mkt-tone-hero mkt-tone-navy">
          <div className="mkt-hero">
            <div className="mkt-hero-copy">
              <p className="mkt-kicker">{t.heroKicker}</p>
              <h1>{t.heroTitle}</h1>
              <p className="mkt-lead">{t.heroBody}</p>
              <div className="mkt-cta">
                <a href="#contact" className="mkt-btn-primary">
                  {t.ctaPrimary}
                </a>
                <a href="#ecosystem" className="mkt-btn-ghost">
                  {t.ctaSecondary}
                </a>
              </div>
            </div>
            <MarketingFilm label={t.heroVideoAlt} />
          </div>
        </Shell>

        <Shell id="audience" tone="mkt-tone-light">
          <MarketingReveal>
            <p className="mkt-kicker">{t.audienceKicker}</p>
            <h2>{t.audienceTitle}</h2>
            <p className="mkt-section-lead">{t.audienceLead}</p>
            <div className="mkt-cards">
              <article>
                <Glyph name="bus" />
                <h3>{t.audienceCompaniesTitle}</h3>
                <p>{t.audienceCompaniesBody}</p>
              </article>
            </div>
          </MarketingReveal>
        </Shell>

        <Shell id="ecosystem" tone="mkt-tone-navy">
          <MarketingReveal>
            <p className="mkt-kicker">{t.ecoKicker}</p>
            <h2>{t.ecoTitle}</h2>
            <p className="mkt-section-lead">{t.ecoLead}</p>
            <div className="mkt-cards">
              <article>
                <span>01</span>
                <Glyph name="phone" />
                <h3>{t.passengerTitle}</h3>
                <p>{t.passengerBody}</p>
              </article>
              <article>
                <span>02</span>
                <Glyph name="wheel" />
                <h3>{t.driverTitle}</h3>
                <p>{t.driverBody}</p>
              </article>
              <article>
                <span>03</span>
                <Glyph name="board" />
                <h3>{t.adminTitle}</h3>
                <p>{t.adminBody}</p>
              </article>
            </div>
          </MarketingReveal>
          <MarketingReveal>
            <figure className="mkt-fleet">
              <img
                src="/marketing/admin-map.jpg"
                alt={t.adminShotAlt}
                width={1600}
                height={900}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </MarketingReveal>
        </Shell>

        <Shell id="how" tone="mkt-tone-light">
          <MarketingReveal>
            <p className="mkt-kicker">{t.howKicker}</p>
            <h2>{t.howTitle}</h2>
            <ol className="mkt-steps">
              <li>
                <strong>{t.how1Title}</strong>
                <span>{t.how1Body}</span>
              </li>
              <li>
                <strong>{t.how2Title}</strong>
                <span>{t.how2Body}</span>
              </li>
              <li>
                <strong>{t.how3Title}</strong>
                <span>{t.how3Body}</span>
              </li>
            </ol>
          </MarketingReveal>
        </Shell>

        <Shell id="features" tone="mkt-tone-navy">
          <MarketingReveal>
            <p className="mkt-kicker">{t.featuresKicker}</p>
            <h2>{t.featuresTitle}</h2>
            <p className="mkt-section-lead">{t.featuresLead}</p>
            <dl className="mkt-spec">
              <div>
                <Glyph name="map" />
                <dt>{t.featureFleetTitle}</dt>
                <dd>{t.featureFleetBody}</dd>
              </div>
              <div>
                <Glyph name="route" />
                <dt>{t.featureRoutesTitle}</dt>
                <dd>{t.featureRoutesBody}</dd>
              </div>
              <div>
                <Glyph name="pin" />
                <dt>{t.featureTrackTitle}</dt>
                <dd>{t.featureTrackBody}</dd>
              </div>
              <div>
                <Glyph name="clock" />
                <dt>{t.featureTripTitle}</dt>
                <dd>{t.featureTripBody}</dd>
              </div>
            </dl>
          </MarketingReveal>
        </Shell>

        <Shell id="apps" tone="mkt-tone-navy">
          <MarketingReveal>
            <p className="mkt-kicker">{t.appsKicker}</p>
            <h2>{t.appsTitle}</h2>
            <p className="mkt-section-lead">{t.appsLead}</p>
            <div className="mkt-apps">
              <article className="mkt-app mkt-app-passenger">
                <div className="mkt-app-copy">
                  <h3>{t.passengerAppName}</h3>
                  <p>{t.passengerBody}</p>
                  <ul>
                    {t.passengerPoints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <StoreActions app="passenger" locale={locale} />
                </div>
                <figure className="mkt-phones">
                  <img
                    src="/marketing/passenger-phones.png"
                    alt={t.heroVisualAlt}
                    width={1024}
                    height={751}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              </article>
              <article className="mkt-app mkt-app-flip">
                <div className="mkt-app-copy">
                  <h3>{t.driverAppName}</h3>
                  <p>{t.driverBody}</p>
                  <ul>
                    {t.driverPoints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <StoreActions app="driver" locale={locale} />
                </div>
                <figure className="mkt-phones">
                  <img
                    src="/marketing/driver-phones.png?v=20261125"
                    alt={t.driverSigninAlt}
                    width={1600}
                    height={1168}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              </article>
            </div>
          </MarketingReveal>
        </Shell>

        <Shell id="contact" tone="mkt-tone-contact">
          <MarketingReveal>
            <div className="mkt-demo">
              <div className="mkt-demo-copy">
                <p className="mkt-kicker">{t.contactKicker}</p>
                <h2>{t.contactTitle}</h2>
                <p className="mkt-demo-lead">{t.contactBody}</p>
                <ul className="mkt-demo-points">
                  {t.contactPoints.map((point) => (
                    <li key={point}>
                      <span className="mkt-demo-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5 10 17l9-10" />
                        </svg>
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mkt-demo-card">
                <h3>{t.contactCardTitle}</h3>
                <p>{t.contactCardBody}</p>
                {mail ? (
                  <a className="mkt-btn-primary mkt-demo-mail" href={`mailto:${mail}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                    <span dir="ltr">{t.contactEmailCta}</span>
                  </a>
                ) : (
                  <p className="mkt-contact-note">{t.contactNoEmail}</p>
                )}
                <div className="mkt-demo-login">
                  <span>{t.contactLoginHint}</span>
                  <Link href="/login">{t.contactLogin}</Link>
                </div>
              </div>
            </div>
          </MarketingReveal>
        </Shell>

        <Shell id="faq" tone="mkt-tone-light">
          <MarketingReveal>
            <p className="mkt-kicker">{t.faqKicker}</p>
            <h2>{t.faqTitle}</h2>
            <div className="mkt-faq">
              {t.faqs.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </MarketingReveal>
        </Shell>
      </main>
    </MarketingFrame>
  );
}
