import type { GraphicJobDetail, GraphicJobFormOptions } from "@/features/graphics/dal";

export function GraphicJobFormFields({
  job,
  options,
}: {
  job?: GraphicJobDetail;
  options: GraphicJobFormOptions;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Código interno">
          <input className={inputClassName} defaultValue={job?.internalCode} maxLength={80} name="internalCode" required />
        </Field>
        <Field label="Título">
          <input className={inputClassName} defaultValue={job?.title} maxLength={200} name="title" required />
        </Field>
        <Field label="Cliente">
          <select className={inputClassName} defaultValue={job?.clientId ?? ""} name="clientId" required>
            <option disabled value="">Selecione</option>
            {options.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Responsável">
          <select className={inputClassName} defaultValue={job?.responsibleEmployeeId ?? ""} name="responsibleEmployeeId" required>
            <option disabled value="">Selecione</option>
            {options.employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Projeto/evento (opcional)">
          <select className={inputClassName} defaultValue={job?.projectId ?? ""} name="projectId">
            <option value="">Sem projeto</option>
            {options.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Data da solicitação">
          <input className={inputClassName} defaultValue={toDateInput(job?.requestedAt)} name="requestedAt" type="date" />
        </Field>
        <Field label="Entrega desejada (opcional)">
          <input className={inputClassName} defaultValue={toDateInput(job?.desiredDeliveryAt)} name="desiredDeliveryAt" type="date" />
        </Field>
      </div>
      <Field label="Descrição">
        <textarea className={textareaClassName} defaultValue={job?.description} maxLength={4000} name="description" required rows={6} />
      </Field>
      <Field label="Observações internas (opcional)">
        <textarea className={textareaClassName} defaultValue={job?.notes ?? ""} maxLength={2000} name="notes" rows={4} />
      </Field>
      <p className="text-sm text-muted-foreground">
        A OS externa não é necessária nesta etapa. O trabalho começará em busca de fornecedor.
      </p>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid min-w-0 gap-1 text-sm font-medium">{label}{children}</label>;
}

function toDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

const inputClassName = "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const textareaClassName = "w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
