import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  return <AppShell context={context}>{children}</AppShell>;
}
