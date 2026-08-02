import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/fg/toast";
import { PortalShell } from "@/components/layout/portal-shell";
import { getPortalEmployeeSummary } from "@/features/portal/dal";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const context = await getCurrentAccessContext();
  if (!context) {
    redirect("/login");
  }

  if (!context.organizationId) {
    redirect("/acesso-negado");
  }

  const summary = await getPortalEmployeeSummary(context);

  return (
    <ToastProvider>
      <PortalShell
        user={{
          name: summary?.fullName ?? "Colaborador",
          registrationNumber: summary?.registrationNumber ?? null,
        }}
        employmentType={summary?.employmentType ?? "clt"}
      >
        {children}
      </PortalShell>
    </ToastProvider>
  );
}
