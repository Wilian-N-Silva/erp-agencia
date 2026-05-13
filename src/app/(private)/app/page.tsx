import { redirect } from "next/navigation";

import { listClientPaymentAlerts } from "@/features/clients/dal";
import { clientReminderKindLabels } from "@/features/clients/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  const paymentAlerts = can("finance.read", context)
    ? await listClientPaymentAlerts(context, { limit: 8 })
    : [];
  const summaryItems = [
    { label: "Pendencias", value: String(paymentAlerts.length) },
    { label: "Alertas", value: String(paymentAlerts.length) },
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
          <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Sem eventos proximos
          </div>
        </section>
      </div>
    </section>
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
