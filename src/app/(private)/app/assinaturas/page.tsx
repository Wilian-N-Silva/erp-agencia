import { Ban, Boxes, Link2, Plus, RefreshCw, Unlink } from "lucide-react";
import { redirect } from "next/navigation";

import { ActionSheet, Button, MoneyInput } from "@/components/fg";
import {
  cancelSaasSubscriptionAction,
  createSaasSubscriptionAction,
  linkEmployeeToSaasSubscriptionAction,
  markSaasSubscriptionRenewedAction,
  unlinkEmployeeFromSaasSubscriptionAction,
} from "@/features/saas/actions";
import {
  listSaasEmployeeOptions,
  listSaasSubscriptions,
  type SaasEmployeeOption,
  type SaasSubscriptionListItem,
} from "@/features/saas/dal";
import {
  canReadSaasCost,
  canWriteSaasSubscriptions,
  normalizeSaasSubscriptionFilters,
  saasSubscriptionStatusLabels,
} from "@/features/saas/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

import { SaasView } from "./saas-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SaasSubscriptionsPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(["saas.read", "saas.write", "saas.configure"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeSaasSubscriptionFilters((await searchParams) ?? {});
  const canWrite = canWriteSaasSubscriptions(context);
  const canSeeCosts = canReadSaasCost(context);
  const [subscriptions, employeeOptions] = await Promise.all([
    listSaasSubscriptions(context, filters),
    canWrite ? listSaasEmployeeOptions(context) : Promise.resolve([]),
  ]);

  const primaryAction = canWrite ? (
    <ActionSheet
      title="Cadastrar assinatura"
      description="Adicione uma nova ferramenta ao portfólio."
      trigger={
        <Button variant="primary" size="sm" icon={<Plus size={14} />}>
          Cadastrar assinatura
        </Button>
      }
    >
      <SaasSubscriptionForm canSeeCosts={canSeeCosts} />
    </ActionSheet>
  ) : null;

  const rowActions: Record<string, React.ReactNode> = {};
  if (canWrite) {
    for (const subscription of subscriptions) {
      rowActions[subscription.id] = (
        <SaasRowActions
          subscription={subscription}
          employeeOptions={employeeOptions}
        />
      );
    }
  }

  return (
    <SaasView
      subscriptions={subscriptions}
      canWrite={canWrite}
      canSeeCosts={canSeeCosts}
      primaryAction={primaryAction}
      rowActions={canWrite ? rowActions : undefined}
    />
  );
}

function SaasSubscriptionForm({ canSeeCosts }: { canSeeCosts: boolean }) {
  return (
    <form action={createSaasSubscriptionAction} className="fg-form">
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">
            Nome<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input className="fg-input" maxLength={160} name="name" required />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Categoria<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input className="fg-input" maxLength={120} name="category" required />
          </div>
        </div>
      </div>
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">Fornecedor</label>
          <div className="fg-input-wrap">
            <input className="fg-input" maxLength={120} name="provider" />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">Status</label>
          <div className="fg-input-wrap">
            <select className="fg-input fg-select" defaultValue="active" name="status">
              {Object.entries(saasSubscriptionStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="fg-form-row">
        {canSeeCosts ? (
          <div className="fg-field">
            <label className="fg-label">Custo mensal</label>
            <MoneyInput name="monthlyCost" />
          </div>
        ) : null}
        <div className="fg-field">
          <label className="fg-label">Renovação</label>
          <div className="fg-input-wrap">
            <input
              className="fg-input fg-tabular"
              name="renewalDate"
              type="date"
            />
          </div>
        </div>
      </div>
      <div className="fg-field">
        <label className="fg-label">Observação</label>
        <textarea
          className="fg-input fg-textarea"
          maxLength={1000}
          name="notes"
          rows={4}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <Boxes size={14} aria-hidden />
          <span>Cadastrar assinatura</span>
        </button>
      </div>
    </form>
  );
}

function SaasRowActions({
  subscription,
  employeeOptions,
}: {
  subscription: SaasSubscriptionListItem;
  employeeOptions: SaasEmployeeOption[];
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
      <ActionSheet
        title="Vincular colaborador"
        description={`Adicionar acesso à ${subscription.name}.`}
        trigger={
          <span
            className="fg-icon-btn sm"
            aria-label="Vincular colaborador"
            title="Vincular"
          >
            <Link2 size={14} />
          </span>
        }
      >
        <LinkSubscriptionForm
          employeeOptions={employeeOptions}
          subscriptionId={subscription.id}
        />
      </ActionSheet>
      <ActionSheet
        title="Renovar assinatura"
        description="Defina a nova data de renovação."
        trigger={
          <span
            className="fg-icon-btn sm"
            aria-label="Renovar assinatura"
            title="Renovar"
          >
            <RefreshCw size={14} />
          </span>
        }
      >
        <RenewSubscriptionForm
          id={subscription.id}
          renewalDate={subscription.renewalDate}
        />
      </ActionSheet>
      {subscription.linkedUsers
        .filter((u) => u.status === "active")
        .slice(0, 1)
        .map((user) => (
          <form
            action={unlinkEmployeeFromSaasSubscriptionAction}
            key={user.employeeId}
            style={{ display: "inline" }}
          >
            <input name="subscriptionId" type="hidden" value={subscription.id} />
            <input name="employeeId" type="hidden" value={user.employeeId} />
            <button
              type="submit"
              className="fg-icon-btn sm"
              aria-label={`Desvincular ${user.employeeName}`}
              title="Desvincular último"
              style={{ color: "var(--status-warning-text)" }}
            >
              <Unlink size={14} />
            </button>
          </form>
        ))}
      {subscription.status !== "cancelled" ? (
        <form action={cancelSaasSubscriptionAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={subscription.id} />
          <button
            type="submit"
            className="fg-icon-btn sm"
            aria-label="Cancelar"
            title="Cancelar"
            style={{ color: "var(--status-danger-text)" }}
          >
            <Ban size={14} />
          </button>
        </form>
      ) : null}
    </div>
  );
}

function LinkSubscriptionForm({
  employeeOptions,
  subscriptionId,
}: {
  employeeOptions: SaasEmployeeOption[];
  subscriptionId: string;
}) {
  return (
    <form action={linkEmployeeToSaasSubscriptionAction} className="fg-form">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <div className="fg-field">
        <label className="fg-label">
          Colaborador<span className="fg-required">*</span>
        </label>
        <div className="fg-input-wrap">
          <select className="fg-input fg-select" name="employeeId" required>
            <option value="">Vincular colaborador</option>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <Link2 size={14} aria-hidden />
          <span>Vincular</span>
        </button>
      </div>
    </form>
  );
}

function RenewSubscriptionForm({
  id,
  renewalDate,
}: {
  id: string;
  renewalDate: string | null;
}) {
  return (
    <form action={markSaasSubscriptionRenewedAction} className="fg-form">
      <input name="id" type="hidden" value={id} />
      <div className="fg-field">
        <label className="fg-label">
          Nova renovação<span className="fg-required">*</span>
        </label>
        <div className="fg-input-wrap">
          <input
            className="fg-input fg-tabular"
            defaultValue={renewalDate ?? ""}
            name="renewalDate"
            required
            type="date"
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <RefreshCw size={14} aria-hidden />
          <span>Renovar</span>
        </button>
      </div>
    </form>
  );
}
