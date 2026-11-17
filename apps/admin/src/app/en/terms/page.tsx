import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";
import { legalMetadata } from "@/lib/seo";

export const metadata: Metadata = legalMetadata("en", "terms");

export default function TermsEnPage() {
  return <LegalPage locale="en" page="terms" />;
}
