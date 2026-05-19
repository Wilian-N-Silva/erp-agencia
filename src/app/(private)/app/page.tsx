import { redirect } from "next/navigation";

import { listAccessReviewAlerts } from "@/features/accesses/dal";
import { listClientPaymentAlerts } from "@/features/clients/dal";
import { clientReminderKindLabels } from "@/features/clients/rules";
import { listEquipmentReturnAlerts } from "@/features/equipment/dal";
import { formatDate } from "@/features/finance/rules";
import { listLifecycleDashboardItems } from "@/features/lifecycle/dal";
import { lifecycleTypeLabels } from "@/features/lifecycle/rules";
import { listSaasRenewalAlerts } from "@/features/saas/dal";
import { getCurrentAccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  const [paymentAlerts, equipmentAlerts, accessAlerts, saasAlerts, lifecycleItems] = await Promise.all([
    can("finance.read", context) ? listClientPaymentAlerts(context, { limit: 8 }) : Promise.resolve([]),
    canAny(["equipment.read", "equipment.write", "equipment.configure", "equipment.read_team"], context)
      ? listEquipmentReturnAlerts(context, { limit: 4 })
      : Promise.resolve([]),
    canAny(["access_records.read", "access_records.write", "access_records.configure", "access_records.read_team"], context)
      ? listAccessReviewAlerts(context, { limit: 4 })
      : Promise.resolve([]),
    canAny(["saas.read", "saas.write", "saas.configure"], context)
      ? listSaasRenewalAlerts(context, { limit: 4 })
      : Promise.resolve([]),
    canAny(["lifecycle.read", "lifecycle.write"], context)
      ? listLifecycleDashboardItems(context, { limit: 4 })
      : Promise.resolve([]),
  ]);
  const governanceAlerts = equipmentAlerts.length + accessAlerts.length + saasAlerts.length;
  const operationalAlerts = governanceAlerts + lifecycleItems.length;
  const summaryItems = [
    { label: "Pendencias", value: String(paymentAlerts.length + operationalAlerts) },
    { label: "Alertas", value: String(paymentAlerts.length + operationalAlerts) },
    { label: "Aprovacoes", value: "0" },
    { label: "Vencimentos", value: String(paymentAlerts.filter((alert) => alert.kind === "due_today").length) },
  ];

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visao operacional</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryItems.map((item) => (
          <div className="rounded-lg border bg-card p-4" key={item.label}>
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Fila principal</h2>
          </div>
          {paymentAlerts.length === 0 ? (
            <div className="p-4">
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Sem itens pendentes
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {paymentAlerts.map((alert) => (
                <div className="grid gap-2 px-4 py-3 text-sm" key={`${alert.clientId}:${alert.financialEntryId ?? alert.kind}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{alert.title}</p>
                    <AlertBadge severity={alert.severity} label={clientReminderKindLabels[alert.kind]} />
                  </div>
                  <p className="text-muted-foreground">{alert.description}</p>
                  <p className="text-xs text-muted-foreground">Vencimento: {formatDate(alert.dueDate)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Eventos proximos</h2>
          {operationalAlerts === 0 ? (
            <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Sem eventos proximos
            </div>
          ) : (
            <div className="mt-4 divide-y rounded-md border">
              {lifecycleItems.map((item) => (
                <EventItem
                  description={`${item.employeeName} - prazo ${formatDate(item.dueDate)} - ${item.progress.requiredResolved}/${item.progress.requiredTotal}`}
                  key={`lifecycle:${item.id}`}
                  title={`${lifecycleTypeLabels[item.type]} em aberto`}
                />
              ))}
              {equipmentAlerts.map((item) => (
                <EventItem
                  description={`${item.currentEmployeeName ?? "Sem responsavel"} - ${item.type}`}
                  key={`equipment:${item.id}`}
                  title={`${item.assetNumber}: devolucao pendente`}
                />
              ))}
              {accessAlerts.map((item) => (
                <EventItem
                  description={`${item.employeeName} - revisao ${formatDate(item.reviewDueDate)}`}
                  key={`access:${item.id}`}
                  title={`${item.platform}: acesso critico`}
                />
              ))}
              {saasAlerts.map((item) => (
                <EventItem
                  description={`Renovacao ${formatDate(item.renewalDate)}`}
                  key={`saas:${item.id}`}
                  title={`${item.name}: assinatura a revisar`}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function EventItem({ description, title }: { description: string; title: string }) {
  return (
    <div className="grid gap-1 px-3 py-2 text-sm">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function AlertBadge({
  label,
  severity,
}: {
  label: string;
  severity: "low" | "medium" | "high";
}) {
  const className =
    severity === "high"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : severity === "medium"
        ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
        : "border-muted bg-muted text-muted-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{label}</span>;
}
