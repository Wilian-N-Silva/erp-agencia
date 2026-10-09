"use client";
import { useActionState, useState } from "react";
import { correctGraphicSaleAction } from "./sale-correction-actions";

export function GraphicSaleCorrectionForm({
  jobId,
  saleId,
  revision,
  amount,
  competence,
  installments,
}: {
  jobId: string;
  saleId: string;
  revision: string;
  amount: string;
  competence: string;
  installments: Array<{
    entryId: string;
    label: string;
    amount: string;
    dueDate: string;
  }>;
}) {
  const [rows, setRows] = useState(installments);
  const [result, submit, pending] = useActionState(
    async (_state: { ok: boolean; message: string } | null, data: FormData) =>
      correctGraphicSaleAction(data),
    null,
  );
  return (
    <form action={submit} className="mt-3 grid gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="revision" value={revision} />
      <input
        type="hidden"
        name="installments"
        value={JSON.stringify(
          rows.map(({ entryId, amount, dueDate }) => ({
            entryId,
            amount,
            dueDate,
          })),
        )}
      />
      <p>
        Confira os dados combinados com o cliente. Esta correção preserva a
        venda original, a OS e os vínculos das parcelas. Estorne recebimentos ou
        revise reservas antes de continuar. Não altera a quantidade de parcelas.
      </p>
      <label className="grid gap-1">
        Valor corrigido da venda
        <input
          className="fg-input"
          name="amount"
          required
          inputMode="decimal"
          defaultValue={amount}
        />
      </label>
      <label className="grid gap-1">
        Competência corrigida da venda
        <input
          className="fg-input"
          name="competence"
          required
          type="month"
          defaultValue={competence}
        />
      </label>
      {rows.map((row, i) => (
        <fieldset key={row.entryId} className="grid gap-2 rounded border p-2">
          <legend>{row.label}</legend>
          <label>
            Valor corrigido da parcela {i + 1}
            <input
              className="fg-input"
              required
              inputMode="decimal"
              value={row.amount}
              onChange={(event) =>
                setRows(
                  rows.map((value, n) =>
                    n === i ? { ...value, amount: event.target.value } : value,
                  ),
                )
              }
            />
          </label>
          <label>
            Vencimento corrigido da parcela {i + 1}
            <input
              className="fg-input"
              required
              type="date"
              value={row.dueDate}
              onChange={(event) =>
                setRows(
                  rows.map((value, n) =>
                    n === i ? { ...value, dueDate: event.target.value } : value,
                  ),
                )
              }
            />
          </label>
        </fieldset>
      ))}
      <label className="grid gap-1">
        Motivo da correção da venda
        <textarea
          className="fg-input"
          name="reason"
          required
          minLength={5}
          maxLength={1000}
        />
      </label>
      <button
        className="fg-btn fg-btn-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Salvando…" : "Salvar correção da venda"}
      </button>
      {result ? <p role="status">{result.message}</p> : null}
    </form>
  );
}
