import type { Metadata } from "next";
import MarketingSite from "@/components/marketing/MarketingSite";
import { marketingMetadata } from "@/lib/seo";

export const metadata: Metadata = marketingMetadata("ar");

export default function MarketingHomePage() {
  return <MarketingSite locale="ar" />;
}
