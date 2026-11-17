import { appDistribution, type DistributedApp } from "@/lib/appDistribution";
import type { MarketingLocale } from "@/lib/marketingCopy";

const badges: Record<
  MarketingLocale,
  { ios: string; android: string; iosAlt: string; androidAlt: string }
> = {
  ar: {
    ios: "/marketing/app-store-ar.svg",
    android: "/marketing/google-play-ar.png",
    iosAlt: "تنزيل من App Store",
    androidAlt: "احصل عليه من Google Play",
  },
  en: {
    ios: "/marketing/app-store-en.svg",
    android: "/marketing/google-play-en.png",
    iosAlt: "Download on the App Store",
    androidAlt: "Get it on Google Play",
  },
};

export default function StoreActions({
  app,
  locale,
}: {
  app: DistributedApp;
  locale: MarketingLocale;
}) {
  const stores = appDistribution[app];
  const art = badges[locale];

  return (
    <div className="mkt-stores">
      <StoreBadge href={stores.ios.url} src={art.ios} alt={art.iosAlt} kind="ios" />
      <StoreBadge href={stores.android.url} src={art.android} alt={art.androidAlt} kind="android" />
    </div>
  );
}

function StoreBadge({
  href,
  src,
  alt,
  kind,
}: {
  href: string | null;
  src: string;
  alt: string;
  kind: "ios" | "android";
}) {
  const image = (
    <img
      className={kind === "ios" ? "mkt-store-badge" : "mkt-store-badge mkt-store-badge-play"}
      src={src}
      alt={alt}
      height={kind === "ios" ? 40 : 60}
    />
  );

  if (href) {
    return (
      <a className="mkt-store-link" href={href} rel="noopener noreferrer">
        {image}
      </a>
    );
  }

  return <span className="mkt-store-link">{image}</span>;
}
