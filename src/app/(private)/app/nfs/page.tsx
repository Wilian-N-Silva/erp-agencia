import { Ban, Check, DollarSign, RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/fg";
import {
  approveInvoiceRequestAction,
  markInvoicePaidAction,
  rejectInvoiceRequestAction,
} from "@/features/portal/actions";
import {
  listInvoiceEmployeeOptions,
  listInvoiceRequests,
  type InvoiceRequestListItem,
} from "@/features/portal/dal";
import {
  canCreateInvoiceRequest,
  canMarkInvoicePaid,
  canReviewInvoice,
} from "@/features/portal/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

import { NewInvoiceSheet } from "./new-invoice-form";
import { NfsView } from "./nfs-view";

export const dynamic = "force-dynamic";

export default async function InvoiceRequestsPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["invoices.read", "invoices.write", "invoices.approve"], context)) {
    redirect("/acesso-negado");
  }

  const canCreate = canCreateInvoiceRequest(context);
  const canApprove = canAny(["invoices.approve"], context);

  const [invoices, employeeOptions] = await Promise.all([
    listInvoiceRequests(context),
    canCreate ? listInvoiceEmployeeOptions(context) : Promise.resolve([]),
  ]);

  const rowActions: Record<string, ReactNode> = {};
  for (const invoice of invoices) {
    rowActions[invoice.id] = buildRowActions({ invoice, canApprove });
  }

  const newInvoiceAction = canCreate ? (
    <NewInvoiceSheet
      employeeOptions={employeeOptions.map((employee) => ({
        id: employee.id,
        name: employee.name,
      }))}
    />
  ) : null;

  return (
    <NfsView
      invoices={invoices}
      canCreate={canCreate}
      canApprove={canApprove}
      newInvoiceAction={newInvoiceAction}
      rowActions={rowActions}
    />
  );
}

function buildRowActions({
  invoice,
  canApprove,
}: {
  invoice: InvoiceRequestListItem;
  canApprove: boolean;
}): ReactNode {
  if (!canApprove) return null;

  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      {canReviewInvoice(invoice.status) ? (
        <>
          <form action={approveInvoiceRequestAction} style={{ display: "inline" }}>
            <input name="id" type="hidden" value={invoice.id} />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={<Check size={13} />}
              title="Aprovar"
            >
              Aprovar
            </Button>
          </form>
          <form action={rejectInvoiceRequestAction} style={{ display: "inline" }}>
            <input name="id" type="hidden" value={invoice.id} />
            <input name="adjustment" type="hidden" value="on" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              icon={<RefreshCw size={13} />}
              title="Pedir ajuste"
            >
              Ajuste
            </Button>
          </form>
          <form action={rejectInvoiceRequestAction} style={{ display: "inline" }}>
            <input name="id" type="hidden" value={invoice.id} />
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              icon={<Ban size={13} />}
              title="Recusar"
            >
              Recusar
            </Button>
          </form>
        </>
      ) : null}
      {canMarkInvoicePaid(invoice.status) ? (
        <form action={markInvoicePaidAction} style={{ display: "inline" }}>
          <input name="id" type="hidden" value={invoice.id} />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={<DollarSign size={13} />}
            title="Marcar pago"
          >
            Marcar pago
          </Button>
        </form>
      ) : null}
    </span>
  );
}
