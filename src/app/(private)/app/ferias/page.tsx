import { Ban, CheckCircle2, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";

import {
  approveTimeOffRequestAction,
  rejectTimeOffRequestAction,
} from "@/features/timeoff/actions";
import { listTimeOffRequests, type TimeOffListItem } from "@/features/timeoff/dal";
import {
  canApproveTimeOff,
  timeOffStatusLabels,
  timeOffTypeLabels,
} from "@/features/timeoff/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

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

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Ferias e pausas</h1>
        <p className="text-sm text-muted-foreground">Solicitacoes, aprovacoes e historico</p>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Solicitacoes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Periodo</th>
                <th className="px-4 py-3 font-medium">Dias uteis</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    Nenhuma solicitacao encontrada.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <TimeOffRow context={context} key={request.id} request={request} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function TimeOffRow({ context, request }: { context: AccessContext; request: TimeOffListItem }) {
  const canApprove = canApproveTimeOff(context, {
    employeeId: request.employeeId,
    managerEmployeeId: request.managerEmployeeId,
    status: request.status,
  });

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">{request.employeeName}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {timeOffTypeLabels[request.type as keyof typeof timeOffTypeLabels] ?? request.type}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDate(request.startDate)} a {formatDate(request.endDate)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{request.businessDays}</td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-md border border-secondary/30 bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary-foreground">
          {timeOffStatusLabels[request.status]}
        </span>
      </td>
      <td className="px-4 py-3">
        {canApprove ? (
          <div className="flex justify-end gap-2">
            <form action={approveTimeOffRequestAction}>
              <input name="id" type="hidden" value={request.id} />
              <IconButton icon={CheckCircle2} label="Aprovar" tone="primary" />
            </form>
            <form action={rejectTimeOffRequestAction}>
              <input name="id" type="hidden" value={request.id} />
              <IconButton icon={Ban} label="Recusar" tone="destructive" />
            </form>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function IconButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: "destructive" | "primary";
}) {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <button aria-label={label} className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`} title={label} type="submit">
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
