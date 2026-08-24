import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/fg/toast";
import { PortalShell } from "@/components/layout/portal-shell";
import { getPortalEmployeeSummary } from "@/features/portal/dal";
import { PortalEmployeeLinkRequired } from "@/features/portal/employee-link-required";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const context = await getCurrentAccessContext();
  if (!context) {
    redirect("/login");
  }

  const summary = await getPortalEmployeeSummary(context);

  if (!summary) {
    return (
      <ToastProvider>
        <PortalEmployeeLinkRequired />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PortalShell
        user={{
          name: summary.fullName,
          registrationNumber: summary.registrationNumber,
        }}
        employmentType={summary.employmentType}
      >
        {children}
      </PortalShell>
    </ToastProvider>
  );
}
