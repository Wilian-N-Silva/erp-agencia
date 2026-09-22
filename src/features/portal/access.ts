import { redirect } from "next/navigation";
import { cache } from "react";

import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";

import { getPortalEmployeeSummary, type PortalEmployeeSummary } from "./dal";

export type PortalEmployeeAccess = {
  context: AccessContext;
  employee: PortalEmployeeSummary;
};

export const getCurrentPortalEmployeeAccess = cache(
  async (): Promise<PortalEmployeeAccess | null> => {
    const context = await getCurrentAccessContext();
    if (!context) {
      redirect("/login");
    }

    const employee = await getPortalEmployeeSummary(context);
    if (!employee) {
      return null;
    }

    return { context, employee };
  },
);
