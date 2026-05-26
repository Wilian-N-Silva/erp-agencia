import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAccessBackoffice } from "@/lib/rbac";
import { ToastProvider } from "@/components/fg/toast";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [context, session] = await Promise.all([
    getCurrentAccessContext(),
    getCurrentSession(),
  ]);

  if (!context) {
    redirect("/login");
  }

  if (!canAccessBackoffice(context.permissions)) {
    redirect("/portal");
  }

  return (
    <ToastProvider>
      <AppShell context={context} user={session?.user}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
