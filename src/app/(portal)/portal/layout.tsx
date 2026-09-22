import type { ReactNode } from "react";

import { ToastProvider } from "@/components/fg/toast";
import { PortalShell } from "@/components/layout/portal-shell";
import { getCurrentPortalEmployeeAccess } from "@/features/portal/access";
import { PortalEmployeeLinkRequired } from "@/features/portal/employee-link-required";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const access = await getCurrentPortalEmployeeAccess();
  if (!access) {
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
          name: access.employee.fullName,
          registrationNumber: access.employee.registrationNumber,
        }}
        employmentType={access.employee.employmentType}
      >
        {children}
      </PortalShell>
    </ToastProvider>
  );
}
