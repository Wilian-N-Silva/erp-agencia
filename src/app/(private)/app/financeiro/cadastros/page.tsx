import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Button, Card, Field, Input, Page, PageHeader, RateLimitedActionForm, StatusBadge, Textarea } from "@/components/fg";
import {
  createCostCenterAction,
  createFinancialAccountAction,
  createFinancialCategoryAction,
  createSupplierAction,
  setCostCenterStatusAction,
  setFinancialAccountStatusAction,
  setFinancialCategoryStatusAction,
  setSupplierStatusAction,
  updateCostCenterAction,
  updateFinancialAccountAction,
  updateFinancialCategoryAction,
  updateSupplierAction,
} from "@/features/finance-master-data/actions";
import { getFinanceMasterData } from "@/features/finance-master-data/dal";
import { financeMasterDataReadPermissions, financialAccountTypeLabels, financialCategoryNatureLabels } from "@/features/finance-master-data/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";
import type { FormServerAction } from "@/lib/server-action-result";

export default async function FinanceMasterDataPage() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(financeMasterDataReadPermissions, context)) redirect("/acesso-negado");

  const data = await getFinanceMasterData(context);
  const canConfigure = can("finance.configure", context);

  return (
    <Page>
      <PageHeader
        eyebrow="Financeiro"
        title="Cadastros financeiros"
        description="Contas, categorias, centros de custo e fornecedores compartilhados pela organização."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <MasterCard title="Contas financeiras" description="Contas bancárias, caixas e contas de passagem." createForm={canConfigure ? <AccountForm action={createFinancialAccountAction} submitLabel="Adicionar conta" /> : null}>
          {data.accounts.map((item) => (
            <MasterRow key={item.id} name={item.name} active={item.status === "active"} detail={financialAccountTypeLabels[item.type as keyof typeof financialAccountTypeLabels] ?? item.type} canConfigure={canConfigure} statusAction={setFinancialAccountStatusAction} id={item.id}>
              <AccountForm action={updateFinancialAccountAction} submitLabel="Salvar conta" item={item} />
            </MasterRow>
          ))}
        </MasterCard>

        <MasterCard title="Categorias financeiras" description="Classificação gerencial de receitas e despesas." createForm={canConfigure ? <CategoryForm action={createFinancialCategoryAction} submitLabel="Adicionar categoria" /> : null}>
          {data.categories.map((item) => (
            <MasterRow key={item.id} name={item.name} active={item.isActive} detail={financialCategoryNatureLabels[item.nature as keyof typeof financialCategoryNatureLabels] ?? item.nature} canConfigure={canConfigure} statusAction={setFinancialCategoryStatusAction} id={item.id}>
              <CategoryForm action={updateFinancialCategoryAction} submitLabel="Salvar categoria" item={item} />
            </MasterRow>
          ))}
        </MasterCard>

        <MasterCard title="Centros de custo" description="Estrutura transversal; não representa projeto ou evento." createForm={canConfigure ? <CostCenterForm action={createCostCenterAction} submitLabel="Adicionar centro" /> : null}>
          {data.costCenters.map((item) => (
            <MasterRow key={item.id} name={item.name} active={item.isActive} detail={item.code ?? "Sem código"} canConfigure={canConfigure} statusAction={setCostCenterStatusAction} id={item.id}>
              <CostCenterForm action={updateCostCenterAction} submitLabel="Salvar centro" item={item} />
            </MasterRow>
          ))}
        </MasterCard>

        <MasterCard title="Fornecedores" description="Cadastro compartilhado entre Financeiro e Gráfica." createForm={canConfigure ? <SupplierForm action={createSupplierAction} submitLabel="Adicionar fornecedor" /> : null}>
          {data.suppliers.map((item) => (
            <MasterRow key={item.id} name={item.name} active={item.isActive} detail={item.taxId ?? item.email ?? "Sem identificação"} canConfigure={canConfigure} statusAction={setSupplierStatusAction} id={item.id}>
              <SupplierForm action={updateSupplierAction} submitLabel="Salvar fornecedor" item={item} />
            </MasterRow>
          ))}
        </MasterCard>
      </div>
    </Page>
  );
}

function MasterCard({ title, description, createForm, children }: { title: string; description: string; createForm: ReactNode; children: ReactNode }) {
  return (
    <Card title={title} description={description}>
      {createForm ? <details className="mb-4 rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Novo cadastro</summary><div className="mt-3">{createForm}</div></details> : null}
      <div className="divide-y rounded-md border">{children}</div>
    </Card>
  );
}

function MasterRow({ id, name, detail, active, canConfigure, statusAction, children }: { id: string; name: string; detail: string; active: boolean; canConfigure: boolean; statusAction: FormServerAction<unknown>; children: ReactNode }) {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
        <StatusBadge label={active ? "Ativo" : "Inativo"} tone={active ? "success" : "muted"} />
      </div>
      {canConfigure ? (
        <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-primary">Editar cadastro</summary>
          <div className="mt-3 border-t pt-3">{children}</div>
          <RateLimitedActionForm action={statusAction} className="mt-3 flex justify-end">
            <input name="id" type="hidden" value={id} /><input name="active" type="hidden" value={active ? "false" : "true"} />
            <Button type="submit" size="sm" variant={active ? "destructive" : "outline"}>{active ? "Desativar" : "Reativar"}</Button>
          </RateLimitedActionForm>
        </details>
      ) : null}
    </div>
  );
}

type Action = FormServerAction<unknown>;
type AccountItem = Awaited<ReturnType<typeof getFinanceMasterData>>["accounts"][number];
type CategoryItem = Awaited<ReturnType<typeof getFinanceMasterData>>["categories"][number];
type CostCenterItem = Awaited<ReturnType<typeof getFinanceMasterData>>["costCenters"][number];
type SupplierItem = Awaited<ReturnType<typeof getFinanceMasterData>>["suppliers"][number];

function AccountForm({ action, item, submitLabel }: { action: Action; item?: AccountItem; submitLabel: string }) {
  return <RateLimitedActionForm action={action} className="grid gap-3 sm:grid-cols-2">{item ? <input name="id" type="hidden" value={item.id} /> : null}<Field label="Nome" required><Input name="name" defaultValue={item?.name} maxLength={120} required /></Field><Field label="Tipo" required><select className="fg-input fg-select" name="type" defaultValue={item?.type ?? "bank"}>{Object.entries(financialAccountTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Identificação mascarada"><Input name="maskedIdentifier" defaultValue={item?.maskedIdentifier ?? ""} maxLength={80} placeholder="Ex.: Banco •••• 1234" /></Field><Field label="Saldo inicial"><Input name="openingBalance" defaultValue={item?.openingBalance ?? ""} inputMode="decimal" /></Field><Submit label={submitLabel} /></RateLimitedActionForm>;
}

function CategoryForm({ action, item, submitLabel }: { action: Action; item?: CategoryItem; submitLabel: string }) {
  return <RateLimitedActionForm action={action} className="grid gap-3">{item ? <input name="id" type="hidden" value={item.id} /> : null}<div className="grid gap-3 sm:grid-cols-2"><Field label="Nome" required><Input name="name" defaultValue={item?.name} maxLength={100} required /></Field><Field label="Natureza" required><select className="fg-input fg-select" name="nature" defaultValue={item?.nature ?? "both"}>{Object.entries(financialCategoryNatureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div><Field label="Descrição"><Textarea name="description" defaultValue={item?.description ?? ""} maxLength={500} /></Field><Submit label={submitLabel} /></RateLimitedActionForm>;
}

function CostCenterForm({ action, item, submitLabel }: { action: Action; item?: CostCenterItem; submitLabel: string }) {
  return <RateLimitedActionForm action={action} className="grid gap-3">{item ? <input name="id" type="hidden" value={item.id} /> : null}<div className="grid gap-3 sm:grid-cols-2"><Field label="Nome" required><Input name="name" defaultValue={item?.name} maxLength={120} required /></Field><Field label="Código"><Input name="code" defaultValue={item?.code ?? ""} maxLength={40} /></Field></div><Field label="Descrição"><Textarea name="description" defaultValue={item?.description ?? ""} maxLength={500} /></Field><Submit label={submitLabel} /></RateLimitedActionForm>;
}

function SupplierForm({ action, item, submitLabel }: { action: Action; item?: SupplierItem; submitLabel: string }) {
  return <RateLimitedActionForm action={action} className="grid gap-3">{item ? <input name="id" type="hidden" value={item.id} /> : null}<div className="grid gap-3 sm:grid-cols-2"><Field label="Nome" required><Input name="name" defaultValue={item?.name} maxLength={160} required /></Field><Field label="CPF/CNPJ"><Input name="taxId" defaultValue={item?.taxId ?? ""} maxLength={30} /></Field><Field label="Contato"><Input name="contactName" defaultValue={item?.contactName ?? ""} maxLength={120} /></Field><Field label="E-mail"><Input name="email" type="email" defaultValue={item?.email ?? ""} maxLength={254} /></Field><Field label="Telefone"><Input name="phone" defaultValue={item?.phone ?? ""} maxLength={40} /></Field></div><Submit label={submitLabel} /></RateLimitedActionForm>;
}

function Submit({ label }: { label: string }) { return <div className="flex justify-end sm:col-span-2"><Button type="submit" size="sm">{label}</Button></div>; }
