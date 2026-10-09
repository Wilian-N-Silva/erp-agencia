ALTER TABLE "reimbursement_requests" ADD COLUMN "financial_expense_id" uuid;--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursements_payable_tenant_fk" FOREIGN KEY ("organization_id","financial_expense_id") REFERENCES "public"."financial_expenses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reimbursements_payable_idx" ON "reimbursement_requests" USING btree ("financial_expense_id");--> statement-breakpoint
ALTER TABLE "reimbursement_requests" ADD CONSTRAINT "reimbursements_payment_origin_check" CHECK ("reimbursement_requests"."financial_expense_id" is null or "reimbursement_requests"."included_invoice_request_id" is null);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_reimbursement_payable_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.financial_expense_id IS NOT NULL AND (
    NEW.financial_expense_id IS DISTINCT FROM OLD.financial_expense_id OR
    NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
    NEW.employee_id IS DISTINCT FROM OLD.employee_id OR
    NEW.amount IS DISTINCT FROM OLD.amount OR
    NEW.included_invoice_request_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Reimbursement payable origin is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER reimbursement_payable_link_guard BEFORE UPDATE ON reimbursement_requests
FOR EACH ROW EXECUTE FUNCTION guard_reimbursement_payable_link();
