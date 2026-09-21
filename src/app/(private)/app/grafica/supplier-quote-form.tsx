import type { GraphicJobOption, GraphicSupplierQuoteItem } from "@/features/graphics/dal";

export function GraphicSupplierQuoteFormFields({
  jobId,
  quote,
  suppliers,
}: {
  jobId: string;
  quote?: GraphicSupplierQuoteItem;
  suppliers: GraphicJobOption[];
}) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <input name="jobId" type="hidden" value={jobId} />
    {quote ? <input name="id" type="hidden" value={quote.id} /> : null}
    <Field label="Fornecedor">
      <select className={inputClassName} defaultValue={quote?.supplierId ?? ""} name="supplierId" required>
        <option disabled value="">Selecione</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
    </Field>
    <Field label="Valor cotado">
      <input className={inputClassName} defaultValue={quote?.quotedAmount ?? ""} inputMode="decimal" name="quotedAmount" placeholder="0,00" required />
    </Field>
    <Field label="Data da cotação">
      <input className={inputClassName} defaultValue={toDateInput(quote?.quotedAt) ?? toDateInput(new Date()) ?? ""} name="quotedAt" required type="date" />
    </Field>
    <Field label="Prazo estimado">
      <input className={inputClassName} defaultValue={toDateInput(quote?.estimatedDeliveryAt) ?? ""} name="estimatedDeliveryAt" type="date" />
    </Field>
    <Field className="sm:col-span-2" label="Descrição">
      <textarea className={inputClassName} defaultValue={quote?.description ?? ""} maxLength={4000} name="description" required rows={3} />
    </Field>
    <Field className="sm:col-span-2" label="Condições">
      <textarea className={inputClassName} defaultValue={quote?.conditions ?? ""} maxLength={4000} name="conditions" rows={3} />
    </Field>
    <Field className="sm:col-span-2" label="Anexos opcionais (até 5)">
      <input accept=".pdf,.jpg,.jpeg,.png,.xml,.xlsx" className={inputClassName} multiple name="attachments" type="file" />
    </Field>
  </div>;
}

function Field({ children, className = "", label }: { children: React.ReactNode; className?: string; label: string }) {
  return <label className={`grid gap-1 text-sm ${className}`}><span className="font-medium">{label}</span>{children}</label>;
}

function toDateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

const inputClassName = "min-h-10 rounded-md border bg-background px-3 py-2 text-sm";
