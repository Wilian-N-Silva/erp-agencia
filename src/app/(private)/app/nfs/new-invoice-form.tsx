"use client";

import { AlertCircle, ChevronDown, Plus } from "lucide-react";
import { useActionState, useEffect } from "react";

import { ActionSheet, Button, Field, Input, MoneyInput, Textarea } from "@/components/fg";
import {
  createInvoiceRequestFormAction,
  type InvoiceRequestFormState,
} from "@/features/portal/actions";

export interface NewInvoiceSheetProps {
  employeeOptions: { id: string; name: string }[];
}

export function NewInvoiceSheet({ employeeOptions }: NewInvoiceSheetProps) {
  return (
    <ActionSheet
      title="Nova composição de NF"
      description="Cadastre a composição esperada e publique para o PJ enviar a NF."
      width={620}
      trigger={
        <Button type="button" variant="primary" size="sm" icon={<Plus size={14} />}>
          Nova composição
        </Button>
      }
    >
      {({ close }) => <NewInvoiceForm employeeOptions={employeeOptions} onSuccess={close} />}
    </ActionSheet>
  );
}

const INITIAL_STATE: InvoiceRequestFormState = { ok: false };

export interface NewInvoiceFormProps {
  employeeOptions: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function NewInvoiceForm({ employeeOptions, onSuccess }: NewInvoiceFormProps) {
  const [state, formAction, pending] = useActionState(
    createInvoiceRequestFormAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {state.error ? (
        <div className="fg-inline-alert danger">
          <AlertCircle size={16} />
          <div>
            <div className="fg-inline-alert-title">Não foi possível publicar</div>
            <div className="fg-inline-alert-desc">{state.error}</div>
          </div>
        </div>
      ) : null}

      <Field label="Colaborador PJ" required>
        <div className="fg-input-wrap">
          <select className="fg-input fg-select" name="employeeId" required defaultValue="">
            <option value="" disabled>
              Selecionar...
            </option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
          <span className="fg-select-chevron">
            <ChevronDown size={14} />
          </span>
        </div>
      </Field>
      <div className="fg-form-row">
        <Field label="Competência" required>
          <Input name="competence" required type="month" defaultValue={currentCompetence()} />
        </Field>
        <Field label="Prazo de envio" required>
          <Input name="dueDate" required type="date" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Base" required>
          <MoneyInput name="baseAmount" required />
        </Field>
        <Field label="Transporte">
          <MoneyInput name="transportAmount" />
        </Field>
        <Field label="Ajuda de custo">
          <MoneyInput name="allowanceAmount" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Reembolsos">
          <MoneyInput name="reimbursementAmount" />
        </Field>
        <Field label="Outros">
          <MoneyInput name="otherAmount" />
        </Field>
        <Field label="Descontos">
          <MoneyInput name="discountAmount" />
        </Field>
      </div>
      <Field label="Descritivo sugerido">
        <Textarea name="suggestedDescription" rows={3} maxLength={700} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button type="submit" variant="primary" icon={<Plus size={14} />} loading={pending}>
          Publicar solicitação
        </Button>
      </div>
    </form>
  );
}

function currentCompetence() {
  return new Date().toISOString().slice(0, 7);
}
