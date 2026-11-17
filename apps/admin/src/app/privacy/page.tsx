import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";
import { legalMetadata } from "@/lib/seo";

export const metadata: Metadata = legalMetadata("ar", "privacy");

export default function PrivacyArPage() {
  return <LegalPage locale="ar" page="privacy" />;
}
