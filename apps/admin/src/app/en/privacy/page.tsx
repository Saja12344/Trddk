import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";
import { legalMetadata } from "@/lib/seo";

export const metadata: Metadata = legalMetadata("en", "privacy");

export default function PrivacyEnPage() {
  return <LegalPage locale="en" page="privacy" />;
}
