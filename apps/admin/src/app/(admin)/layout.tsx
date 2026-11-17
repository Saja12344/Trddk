import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminAppShell from "@/components/AdminAppShell";
import { getSession } from "@/lib/auth.server";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AdminAppShell>{children}</AdminAppShell>;
}
