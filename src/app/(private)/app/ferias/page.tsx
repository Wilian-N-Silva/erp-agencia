import { Ban, Check } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/fg";
import {
  approveTimeOffRequestAction,
  rejectTimeOffRequestAction,
} from "@/features/timeoff/actions";
import { listTimeOffRequests } from "@/features/timeoff/dal";
import { canApproveTimeOff } from "@/features/timeoff/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

import { FeriasView } from "./ferias-view";

export const dynamic = "force-dynamic";

export default async function TimeOffPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["timeoff.read", "timeoff.write", "timeoff.read_team"], context)) {
    redirect("/acesso-negado");
  }

  const requests = await listTimeOffRequests(context);

  const rowActions: Record<string, ReactNode> = {};
  const detailActions: Record<string, ReactNode> = {};

  for (const request of requests) {
    const canApprove = canApproveTimeOff(context, {
      employeeId: request.employeeId,
      managerEmployeeId: request.managerEmployeeId,
      status: request.status,
    });

    if (!canApprove) {
      continue;
    }

    rowActions[request.id] = (
      <>
        <form action={approveTimeOffRequestAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={request.id} />
          <button
            type="submit"
            className="fg-icon-btn sm"
            aria-label="Aprovar"
            title="Aprovar"
          >
            <Check size={13} />
          </button>
        </form>
        <form action={rejectTimeOffRequestAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={request.id} />
          <button
            type="submit"
            className="fg-icon-btn sm"
            aria-label="Recusar"
            title="Recusar"
          >
            <Ban size={13} />
          </button>
        </form>
      </>
    );

    detailActions[request.id] = (
      <>
        <form action={rejectTimeOffRequestAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={request.id} />
          <Button type="submit" variant="destructive" size="sm" icon={<Ban size={13} />}>
            Recusar
          </Button>
        </form>
        <form action={approveTimeOffRequestAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={request.id} />
          <Button type="submit" variant="primary" size="sm" icon={<Check size={13} />}>
            Aprovar
          </Button>
        </form>
      </>
    );
  }

  return (
    <FeriasView
      requests={requests}
      canCreate={false}
      rowActions={rowActions}
      detailActions={detailActions}
    />
  );
}
