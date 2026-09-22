CREATE TABLE "graphic_supplier_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"contracted_at" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graphic_supplier_commitments" ADD CONSTRAINT "graphic_supplier_commitments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_commitments" ADD CONSTRAINT "graphic_supplier_commitments_job_tenant_fk" FOREIGN KEY ("organization_id","job_id") REFERENCES "public"."graphic_jobs"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_commitments" ADD CONSTRAINT "graphic_supplier_commitments_quote_tenant_fk" FOREIGN KEY ("organization_id","quote_id") REFERENCES "public"."graphic_supplier_quotes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_commitments" ADD CONSTRAINT "graphic_supplier_commitments_expense_tenant_fk" FOREIGN KEY ("organization_id","expense_id") REFERENCES "public"."financial_expenses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_commitments" ADD CONSTRAINT "graphic_supplier_commitments_user_tenant_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_supplier_commitments_quote_idx" ON "graphic_supplier_commitments" USING btree ("organization_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_supplier_commitments_expense_idx" ON "graphic_supplier_commitments" USING btree ("organization_id","expense_id");--> statement-breakpoint
CREATE INDEX "graphic_supplier_commitments_job_idx" ON "graphic_supplier_commitments" USING btree ("organization_id","job_id");