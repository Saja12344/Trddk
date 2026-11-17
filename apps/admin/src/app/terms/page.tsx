import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";
import { legalMetadata } from "@/lib/seo";

export const metadata: Metadata = legalMetadata("ar", "terms");

export default function TermsArPage() {
  return <LegalPage locale="ar" page="terms" />;
}
