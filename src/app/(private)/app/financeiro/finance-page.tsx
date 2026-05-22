import { Ban, CheckCircle2, Pencil, Plus, Save, Upload } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ActionSheet, Button, MoneyInput } from "@/components/fg";
import { listClients } from "@/features/clients/dal";
import {
  cancelFinancialEntryAction,
  cancelFinancialExpenseAction,
  createFinancialEntryAction,
  createFinancialExpenseAction,
  createProvisionAction,
  deactivateProvisionAction,
  markFinancialEntryReceivedAction,
  markFinancialExpensePaidAction,
  updateFinancialEntryAction,
  updateFinancialExpenseAction,
} from "@/features/finance/actions";
import {
  getFinanceDashboard,
  type FinanceEntryListItem,
  type FinanceExpenseListItem,
} from "@/features/finance/dal";
import {
  normalizeFinanceFilters,
  type FinanceFilters,
} from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";

import { FinanceView } from "./finance-view";

type Tab = "entradas" | "saidas" | "provisoes";

export async function renderFinancePage({
  searchParams,
  initialTab,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  initialTab: Tab;
}) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!can("finance.read", context)) redirect("/acesso-negado");

  const filters = normalizeFinanceFilters((await searchParams) ?? {});
  const dashboard = await getFinanceDashboard(context, { filters });
  const canWrite = can("finance.write", context);
  const canExport = can("finance.export", context);
  const clientOptions = canWrite ? await listClients(context) : [];

  const exportHref = `/app/financeiro/exportar${buildFinanceExportQuery(filters)}`;
  const exportXlsxHref = `/app/financeiro/exportar-xlsx${buildFinanceExportQuery(filters)}`;

  const newEntryAction = canWrite ? (
    <ActionSheet
      title="Nova entrada"
      description="Cadastre um novo lançamento de receita."
      trigger={
        <Button variant="primary" size="sm" icon={<Plus size={14} />}>
          Nova entrada
        </Button>
      }
    >
      <EntryForm
        action={createFinancialEntryAction}
        clientOptions={clientOptions}
        mode="create"
        submitLabel="Criar entrada"
      />
    </ActionSheet>
  ) : null;

  const newExpenseAction = canWrite ? (
    <ActionSheet
      title="Nova saída"
      description="Cadastre um novo lançamento de despesa."
      trigger={
        <Button variant="primary" size="sm" icon={<Plus size={14} />}>
          Nova saída
        </Button>
      }
    >
      <ExpenseForm
        action={createFinancialExpenseAction}
        mode="create"
        submitLabel="Criar saída"
      />
    </ActionSheet>
  ) : null;

  const newProvisionAction = canWrite ? (
    <ActionSheet
      title="Nova provisão"
      description="Configure uma provisão recorrente mensal."
      trigger={
        <Button variant="outline" size="sm" icon={<Plus size={14} />}>
          Nova provisão
        </Button>
      }
    >
      <ProvisionForm />
    </ActionSheet>
  ) : null;

  const entryActions: Record<string, ReactNode> = {};
  const expenseActions: Record<string, ReactNode> = {};
  const provisionActions: Record<string, ReactNode> = {};

  if (canWrite) {
    for (const entry of dashboard.entries) {
      entryActions[entry.id] = (
        <EntryRowActions clientOptions={clientOptions} entry={entry} />
      );
    }
    for (const expense of dashboard.expenses) {
      expenseActions[expense.id] = <ExpenseRowActions expense={expense} />;
    }
    for (const provision of dashboard.provisions) {
      provisionActions[provision.id] = (
        <ProvisionRowActions id={provision.id} status={provision.status} />
      );
    }
  }

  return (
    <FinanceView
      dashboard={dashboard}
      canWrite={canWrite}
      canExport={canExport}
      exportHref={exportHref}
      exportXlsxHref={exportXlsxHref}
      initialTab={initialTab}
      newEntryAction={newEntryAction}
      newExpenseAction={newExpenseAction}
      newProvisionAction={newProvisionAction}
      entryActions={canWrite ? entryActions : undefined}
      expenseActions={canWrite ? expenseActions : undefined}
      provisionActions={canWrite ? provisionActions : undefined}
    />
  );
}

function buildFinanceExportQuery(filters: FinanceFilters) {
  const params = new URLSearchParams();
  if (filters.competence) params.set("competence", filters.competence);
  if (filters.query) params.set("q", filters.query);
  if (filters.entryStatus && filters.entryStatus !== "all") {
    params.set("entryStatus", filters.entryStatus);
  }
  if (filters.expenseStatus && filters.expenseStatus !== "all") {
    params.set("expenseStatus", filters.expenseStatus);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

type FinanceFormAction = (formData: FormData) => Promise<void>;
type FinanceFormMode = "create" | "edit";

const paymentMethodOptions = ["TED", "PIX", "Boleto", "Cartao", "Debito", "Dinheiro"];
const entryCategorySuggestions = [
  "Fee mensal",
  "Projeto pontual",
  "Midia repassada",
  "Reembolso de producao",
  "Outras receitas",
];
const expenseCategorySuggestions = [
  "Folha CLT",
  "Pro-labore",
  "NFs PJ",
  "Aluguel",
  "SaaS",
  "Energia/Agua",
  "Internet",
  "Contabilidade",
  "Marketing",
  "Equipamentos",
  "Beneficios",
  "Freelancers",
  "Reembolsos",
  "Impostos",
  "Outros",
];
const costCenterSuggestions = [
  "Operacao",
  "Criacao",
  "Atendimento",
  "Midia",
  "Estrategia",
  "Administrativo",
];

function currentCompetence() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function EntryForm({
  action,
  clientOptions,
  entry,
  mode,
  submitLabel,
}: {
  action: FinanceFormAction;
  clientOptions: { id: string; name: string }[];
  entry?: FinanceEntryListItem;
  mode: FinanceFormMode;
  submitLabel: string;
}) {
  const SubmitIcon = mode === "create" ? Plus : Save;
  return (
    <form action={action} className="fg-form">
      {entry ? <input name="id" type="hidden" value={entry.id} /> : null}
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">Cliente</label>
          <div className="fg-input-wrap">
            <select
              className="fg-input fg-select"
              defaultValue={entry?.clientId ?? ""}
              name="clientId"
            >
              <option value="">Sem cliente</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">Metodo de pagamento</label>
          <div className="fg-input-wrap">
            <select
              className="fg-input fg-select"
              defaultValue={entry?.paymentMethod ?? ""}
              name="paymentMethod"
            >
              <option value="">Nao informado</option>
              {paymentMethodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="fg-field">
        <label className="fg-label">
          Descrição<span className="fg-required">*</span>
        </label>
        <div className="fg-input-wrap">
          <input
            className="fg-input"
            defaultValue={entry?.description ?? ""}
            maxLength={180}
            name="description"
            required
          />
        </div>
      </div>
      <DisabledSelectField
        label="Categoria"
        options={entryCategorySuggestions}
        value="Indisponivel"
      />
      <div className="fg-field">
        <label className="fg-label">Responsavel interno</label>
        <div className="fg-input-wrap">
          <input className="fg-input" defaultValue="Usuario atual" disabled />
        </div>
      </div>
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">
            Valor<span className="fg-required">*</span>
          </label>
          <MoneyInput name="amount" required defaultValue={entry?.amount ?? null} />
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Vencimento<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input fg-tabular"
              defaultValue={entry?.dueDate ?? ""}
              name="dueDate"
              required
              type="date"
            />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Competência<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input fg-tabular"
              defaultValue={entry?.competence ?? currentCompetence()}
              name="competence"
              required
              type="month"
            />
          </div>
        </div>
      </div>
      <label className="fg-checkbox">
        <input
          name="recurring"
          type="checkbox"
          defaultChecked={entry?.recurring ?? false}
        />
        <span className="fg-checkbox-box" />
        <span className="fg-checkbox-label">Recorrente</span>
      </label>
      <DisabledAttachmentField />
      <div className="fg-field">
        <label className="fg-label">Observações</label>
        <textarea
          className="fg-input fg-textarea"
          defaultValue={entry?.notes ?? ""}
          maxLength={1000}
          name="notes"
          rows={4}
        />
      </div>
      {mode === "create" ? <FormAuxiliaryOptions /> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <SubmitIcon size={14} aria-hidden />
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
}

function ExpenseForm({
  action,
  expense,
  mode,
  submitLabel,
}: {
  action: FinanceFormAction;
  expense?: FinanceExpenseListItem;
  mode: FinanceFormMode;
  submitLabel: string;
}) {
  const SubmitIcon = mode === "create" ? Plus : Save;
  const categoryDatalistId = expense
    ? `finance-expense-category-options-${expense.id}`
    : "finance-expense-category-options-new";
  const costCenterDatalistId = expense
    ? `finance-expense-cost-center-options-${expense.id}`
    : "finance-expense-cost-center-options-new";
  return (
    <form action={action} className="fg-form">
      {expense ? <input name="id" type="hidden" value={expense.id} /> : null}
      <datalist id={categoryDatalistId}>
        {expenseCategorySuggestions.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <datalist id={costCenterDatalistId}>
        {costCenterSuggestions.map((costCenter) => (
          <option key={costCenter} value={costCenter} />
        ))}
      </datalist>
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">
            Fornecedor<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              defaultValue={expense?.supplier ?? ""}
              maxLength={160}
              name="supplier"
              placeholder="Nome do fornecedor"
              required
            />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Categoria<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              defaultValue={expense?.category ?? ""}
              list={categoryDatalistId}
              maxLength={80}
              name="category"
              required
            />
          </div>
        </div>
      </div>
      <div className="fg-field">
        <label className="fg-label">Subcategoria</label>
        <div className="fg-input-wrap">
          <input
            className="fg-input"
            defaultValue={expense?.subcategory ?? ""}
            maxLength={80}
            name="subcategory"
            placeholder="Opcional"
          />
        </div>
      </div>
      <div className="fg-field">
        <label className="fg-label">
          Descrição<span className="fg-required">*</span>
        </label>
        <div className="fg-input-wrap">
          <input
            className="fg-input"
            defaultValue={expense?.description ?? ""}
            maxLength={180}
            name="description"
            required
          />
        </div>
      </div>
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">
            Valor<span className="fg-required">*</span>
          </label>
          <MoneyInput name="amount" required defaultValue={expense?.amount ?? null} />
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Vencimento<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input fg-tabular"
              defaultValue={expense?.dueDate ?? ""}
              name="dueDate"
              required
              type="date"
            />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Competência<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input fg-tabular"
              defaultValue={expense?.competence ?? currentCompetence()}
              name="competence"
              required
              type="month"
            />
          </div>
        </div>
      </div>
      <div className="fg-field">
        <label className="fg-label">Centro de custo</label>
        <div className="fg-input-wrap">
          <input
            className="fg-input"
            defaultValue={expense?.costCenter ?? ""}
            list={costCenterDatalistId}
            maxLength={100}
            name="costCenter"
          />
        </div>
      </div>
      <DisabledSelectField
        label="Metodo de pagamento"
        options={paymentMethodOptions}
        value="Indisponivel"
      />
      <label className="fg-checkbox">
        <input
          name="recurring"
          type="checkbox"
          defaultChecked={expense?.recurring ?? false}
        />
        <span className="fg-checkbox-box" />
        <span className="fg-checkbox-label">Recorrente</span>
      </label>
      <DisabledAttachmentField />
      <div className="fg-field">
        <label className="fg-label">Observações</label>
        <textarea
          className="fg-input fg-textarea"
          defaultValue={expense?.notes ?? ""}
          maxLength={1000}
          name="notes"
          rows={4}
        />
      </div>
      {mode === "create" ? <FormAuxiliaryOptions /> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <SubmitIcon size={14} aria-hidden />
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
}

function ProvisionForm() {
  return (
    <form action={createProvisionAction} className="fg-form">
      <datalist id="finance-provision-category-options">
        {expenseCategorySuggestions.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">
            Descricao da provisao<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              maxLength={160}
              name="name"
              placeholder="Ex: Folha PJ - media mensal"
              required
            />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Categoria<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              list="finance-provision-category-options"
              maxLength={80}
              name="category"
              required
            />
          </div>
        </div>
      </div>
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">
            Valor mensal<span className="fg-required">*</span>
          </label>
          <MoneyInput name="estimatedMonthlyAmount" required />
        </div>
        <div className="fg-field">
          <label className="fg-label">Dia previsto</label>
          <div className="fg-input-wrap">
            <input
              className="fg-input fg-tabular"
              max={31}
              min={1}
              name="expectedDay"
              placeholder="10"
              type="number"
            />
          </div>
        </div>
      </div>
      <div className="fg-form-row">
        <DisabledSelectField
          label="Metodo de pagamento"
          options={paymentMethodOptions}
          value="Indisponivel"
        />
        <DisabledSelectField
          label="Centro de custo"
          options={costCenterSuggestions}
          value="Indisponivel"
        />
      </div>
      <label className="fg-checkbox">
        <input defaultChecked name="recurring" type="checkbox" />
        <span className="fg-checkbox-box" />
        <span className="fg-checkbox-label">Recorrente</span>
      </label>
      <DisabledAttachmentField />
      <div className="fg-field">
        <label className="fg-label">Observacoes</label>
        <textarea
          className="fg-input fg-textarea"
          maxLength={1000}
          name="notes"
          placeholder="Notas internas, regras de estimativa ou contexto."
          rows={4}
        />
      </div>
      <FormAuxiliaryOptions provisionChecked />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <Plus size={14} aria-hidden />
          <span>Criar provisão</span>
        </button>
      </div>
    </form>
  );
}

function DisabledSelectField({
  label,
  options,
  value,
}: {
  label: string;
  options: string[];
  value: string;
}) {
  return (
    <div className="fg-field">
      <label className="fg-label">{label}</label>
      <div className="fg-input-wrap">
        <select className="fg-input fg-select" defaultValue="" disabled>
          <option value="">{value}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DisabledAttachmentField() {
  return (
    <div className="fg-field">
      <label className="fg-label">Anexo</label>
      <div
        className="fg-dropzone"
        aria-disabled="true"
        style={{ cursor: "not-allowed", opacity: 0.62 }}
      >
        <Upload size={20} aria-hidden />
        <div className="fg-dropzone-text">
          <strong>Upload indisponivel</strong>
        </div>
        <div className="fg-dropzone-hint">
          Comprovante / contrato / nota fiscal
        </div>
        <input disabled hidden type="file" />
      </div>
    </div>
  );
}

function FormAuxiliaryOptions({
  provisionChecked = false,
}: {
  provisionChecked?: boolean;
}) {
  return (
    <div className="fg-form-aux">
      <label className="fg-checkbox" aria-disabled="true">
        <input disabled type="checkbox" />
        <span className="fg-checkbox-box" />
        <span className="fg-checkbox-label">
          Lancamento retroativo (vencimento anterior a hoje)
        </span>
      </label>
      <label className="fg-checkbox" aria-disabled="true">
        <input defaultChecked={provisionChecked} disabled type="checkbox" />
        <span className="fg-checkbox-box" />
        <span className="fg-checkbox-label">
          Criar como provisao recorrente mensal
        </span>
      </label>
    </div>
  );
}

function EntryRowActions({
  clientOptions,
  entry,
}: {
  clientOptions: { id: string; name: string }[];
  entry: FinanceEntryListItem;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
      <ActionSheet
        title="Editar entrada"
        description="Atualize os dados do lançamento."
        trigger={
          <span
            className="fg-icon-btn sm"
            aria-label="Editar entrada"
            title="Editar"
          >
            <Pencil size={14} />
          </span>
        }
      >
        <EntryForm
          action={updateFinancialEntryAction}
          clientOptions={clientOptions}
          entry={entry}
          mode="edit"
          submitLabel="Salvar entrada"
        />
      </ActionSheet>
      {entry.status !== "received" && entry.status !== "cancelled" ? (
        <form action={markFinancialEntryReceivedAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={entry.id} />
          <button
            type="submit"
            className="fg-icon-btn sm"
            aria-label="Marcar como recebido"
            title="Receber"
          >
            <CheckCircle2 size={14} />
          </button>
        </form>
      ) : null}
      {entry.status !== "cancelled" ? (
        <form action={cancelFinancialEntryAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={entry.id} />
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

function ExpenseRowActions({ expense }: { expense: FinanceExpenseListItem }) {
  return (
    <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
      <ActionSheet
        title="Editar saída"
        description="Atualize os dados da despesa."
        trigger={
          <span
            className="fg-icon-btn sm"
            aria-label="Editar saída"
            title="Editar"
          >
            <Pencil size={14} />
          </span>
        }
      >
        <ExpenseForm
          action={updateFinancialExpenseAction}
          expense={expense}
          mode="edit"
          submitLabel="Salvar saída"
        />
      </ActionSheet>
      {expense.status !== "paid" && expense.status !== "cancelled" ? (
        <form action={markFinancialExpensePaidAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={expense.id} />
          <button
            type="submit"
            className="fg-icon-btn sm"
            aria-label="Marcar como pago"
            title="Pagar"
          >
            <CheckCircle2 size={14} />
          </button>
        </form>
      ) : null}
      {expense.status !== "cancelled" ? (
        <form action={cancelFinancialExpenseAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={expense.id} />
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

function ProvisionRowActions({ id, status }: { id: string; status: string }) {
  if (status !== "active") return null;
  return (
    <form
      action={deactivateProvisionAction}
      style={{ display: "inline-flex", justifyContent: "flex-end" }}
    >
      <input name="id" type="hidden" value={id} />
      <button
        type="submit"
        className="fg-icon-btn sm"
        aria-label="Inativar"
        title="Inativar"
        style={{ color: "var(--status-danger-text)" }}
      >
        <Ban size={14} />
      </button>
    </form>
  );
}
