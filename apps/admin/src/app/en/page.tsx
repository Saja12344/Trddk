import type { Metadata } from "next";
import MarketingSite from "@/components/marketing/MarketingSite";
import { marketingMetadata } from "@/lib/seo";

export const metadata: Metadata = marketingMetadata("en");

export default function EnglishMarketingPage() {
  return <MarketingSite locale="en" />;
}
