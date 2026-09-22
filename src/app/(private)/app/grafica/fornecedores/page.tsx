import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, Page, PageHeader, RateLimitedActionForm, StatusBadge } from "@/components/fg";
import { createSupplierAction, updateSupplierAction, setSupplierStatusAction } from "@/features/finance-master-data/actions";
import { getSharedSuppliers } from "@/features/finance-master-data/dal";
import { SupplierForm } from "@/features/finance-master-data/supplier-form";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";
export const dynamic = "force-dynamic";
export default async function GraphicSuppliersPage() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(["finance.configure", "graphics.supplier_write", "graphics.read", "graphics.supplier_quote_write"], context)) redirect("/acesso-negado");
  const rows = await getSharedSuppliers(context);
  const writable = canAny(["finance.configure", "graphics.supplier_write"], context);
  return <Page><PageHeader title="Fornecedores da Gráfica" description="Cadastro compartilhado com o Financeiro. Fornecedores ativos ficam disponíveis para novas cotações." />
    <Link className="text-primary underline" href="/app/grafica">Voltar aos trabalhos</Link>
    {writable ? <Card title="Cadastrar fornecedor"><SupplierForm action={createSupplierAction} submitLabel="Adicionar fornecedor" /></Card> : <p>Para cadastrar ou alterar fornecedores, solicite a permissão de manutenção de fornecedores da Gráfica ao administrador.</p>}
    <Card title={`Fornecedores cadastrados (${rows.length})`}>
      {!rows.length ? <p>Nenhum fornecedor cadastrado. Cadastre o primeiro para iniciar as cotações.</p> : <ul className="divide-y">{rows.map(item => <li className="py-4" key={item.id}>
        <div className="flex items-center justify-between gap-3"><strong>{item.name}</strong><StatusBadge label={item.isActive ? "Ativo" : "Inativo"} tone={item.isActive ? "success" : "muted"} /></div>
        <p className="text-sm text-muted-foreground">{[item.contactName, item.email, item.phone].filter(Boolean).join(" · ") || "Contato não informado"}</p>
        {writable ? <details className="mt-3"><summary className="cursor-pointer text-primary">Editar {item.name}</summary><div className="my-3"><SupplierForm action={updateSupplierAction} item={item} submitLabel="Salvar fornecedor" /></div>
          <RateLimitedActionForm action={setSupplierStatusAction}><input name="id" type="hidden" value={item.id} /><input name="active" type="hidden" value={item.isActive ? "false" : "true"} /><p className="mb-2 text-sm">Desativar impede novas cotações; o histórico existente permanece disponível.</p><Button type="submit" variant="outline">{item.isActive ? "Desativar fornecedor" : "Reativar fornecedor"}</Button></RateLimitedActionForm>
        </details> : null}
      </li>)}</ul>}
    </Card>
  </Page>;
}
