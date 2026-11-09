import type { Metadata } from "next";
import { Suspense } from "react";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...noIndexMetadata,
  title: "TRDDK",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="login-page">جاري التحميل...</div>}>
      {children}
    </Suspense>
  );
}
