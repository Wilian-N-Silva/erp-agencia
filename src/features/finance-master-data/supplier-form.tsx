import { Button, Field, Input, RateLimitedActionForm } from "@/components/fg";
import type { getSharedSuppliers } from "./dal";
import type { FormServerAction } from "@/lib/server-action-result";
type Action = FormServerAction<unknown>;
type SupplierItem = Awaited<ReturnType<typeof getSharedSuppliers>>[number];
export function SupplierForm({ action, item, submitLabel }: { action: Action; item?: SupplierItem; submitLabel: string }) {
  const prefix = `supplier-${item?.id ?? "new"}`;
  return <RateLimitedActionForm action={action} className="grid gap-3">{item ? <input name="id" type="hidden" value={item.id} /> : null}<div className="grid gap-3 sm:grid-cols-2"><Field label="Nome" htmlFor={`${prefix}-name`} required><Input id={`${prefix}-name`} name="name" defaultValue={item?.name} maxLength={160} required /></Field><Field label="CPF/CNPJ" htmlFor={`${prefix}-taxId`}><Input id={`${prefix}-taxId`} name="taxId" defaultValue={item?.taxId ?? ""} maxLength={30} /></Field><Field label="Contato" htmlFor={`${prefix}-contactName`}><Input id={`${prefix}-contactName`} name="contactName" defaultValue={item?.contactName ?? ""} maxLength={120} /></Field><Field label="E-mail" htmlFor={`${prefix}-email`}><Input id={`${prefix}-email`} name="email" type="email" defaultValue={item?.email ?? ""} maxLength={254} /></Field><Field label="Telefone" htmlFor={`${prefix}-phone`}><Input id={`${prefix}-phone`} name="phone" defaultValue={item?.phone ?? ""} maxLength={40} /></Field></div><div className="flex justify-end"><Button type="submit">{submitLabel}</Button></div></RateLimitedActionForm>;
}

