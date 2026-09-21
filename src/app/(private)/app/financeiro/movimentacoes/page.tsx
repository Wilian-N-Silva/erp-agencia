import { redirect } from "next/navigation";

import {
  Button,
  Card,
  Field,
  Input,
  MoneyInput,
  Page,
  PageHeader,
  RateLimitedActionForm,
  StatusBadge,
} from "@/components/fg";
import { createFinancialTransactionAction } from "@/features/finance-transactions/actions";
import {
  getFinancialTransactionFormOptions,
  getFinancialTransactions,
} from "@/features/finance-transactions/dal";
import {
  financialTransactionDirectionLabels,
  financialTransactionStatusLabels,
} from "@/features/finance-transactions/rules";
import { formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function FinancialTransactionsPage() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(["finance.read", "finance.write"], context)) {
    redirect("/acesso-negado");
  }

  const [transactions, options] = await Promise.all([
    getFinancialTransactions(context),
    getFinancialTransactionFormOptions(context),
  ]);
  const canWrite = can("finance.write", context);

  return (
    <Page>
      <PageHeader
        eyebrow="Financeiro"
        title="Movimentações financeiras"
        description="Entradas e saídas de dinheiro efetivamente ocorridas. O vínculo com contas a receber ou pagar será feito na conciliação."
      />

      {canWrite ? (
        <Card
          title="Registrar movimentação"
          description="Toda movimentação começa pendente de conciliação e exige uma conta financeira ativa."
        >
          {options.accounts.length ? (
            <RateLimitedActionForm
              action={createFinancialTransactionAction}
              className="grid gap-4 lg:grid-cols-4"
            >
              <Field label="Direção" required>
                <select className="fg-input fg-select" name="direction" defaultValue="in" required>
                  <option value="in">Entrada</option>
                  <option value="out">Saída</option>
                </select>
              </Field>
              <Field label="Conta financeira" required>
                <select className="fg-input fg-select" name="accountId" defaultValue="" required>
                  <option value="" disabled>Selecione a conta</option>
                  {options.accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Valor" required>
                <MoneyInput name="amount" required minimumCents={1} />
              </Field>
              <Field label="Data da movimentação" required>
                <Input name="occurredAt" type="date" defaultValue={todayInSaoPaulo()} required />
              </Field>
              <Field label="Cliente" helper="Use somente para entradas.">
                <select className="fg-input fg-select" name="clientId" defaultValue="">
                  <option value="">Sem cliente vinculado</option>
                  {options.clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fornecedor" helper="Use somente para saídas.">
                <select className="fg-input fg-select" name="supplierId" defaultValue="">
                  <option value="">Sem fornecedor vinculado</option>
                  {options.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Contraparte livre">
                <Input name="counterpartyName" maxLength={160} placeholder="Quando não houver cadastro" />
              </Field>
              <Field label="Método">
                <Input name="method" maxLength={80} placeholder="PIX, TED, boleto..." />
              </Field>
              <Field label="Referência">
                <Input name="reference" maxLength={160} placeholder="Identificador bancário ou observação curta" />
              </Field>
              <div className="flex items-end justify-end lg:col-span-3">
                <Button type="submit">Registrar movimentação</Button>
              </div>
            </RateLimitedActionForm>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cadastre e ative uma conta financeira antes de registrar movimentações.
            </p>
          )}
        </Card>
      ) : null}

      <Card
        className="mt-5"
        title="Movimentações recentes"
        description="Até 200 registros mais recentes da organização."
        padding={false}
      >
        {transactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Data</th>
                  <th className="p-3">Direção</th>
                  <th className="p-3">Conta</th>
                  <th className="p-3">Contraparte</th>
                  <th className="p-3">Referência</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr className="border-b last:border-0" key={transaction.id}>
                    <td className="p-3 fg-tabular">{formatDate(transaction.occurredAt)}</td>
                    <td className="p-3">{financialTransactionDirectionLabels[transaction.direction]}</td>
                    <td className="p-3">{transaction.accountName}</td>
                    <td className="p-3">{transaction.clientName ?? transaction.supplierName ?? transaction.counterpartyName ?? "—"}</td>
                    <td className="p-3">{transaction.reference ?? transaction.method ?? "—"}</td>
                    <td className="p-3 text-right fg-tabular font-medium">{formatMoney(transaction.amount)}</td>
                    <td className="p-3">
                      <StatusBadge
                        label={financialTransactionStatusLabels[transaction.status]}
                        tone={transaction.status === "reconciled" ? "success" : transaction.status === "reversed" ? "muted" : "warning"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        )}
      </Card>
    </Page>
  );
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(value);
}
