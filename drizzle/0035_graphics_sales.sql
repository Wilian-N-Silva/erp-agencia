CREATE TABLE "graphic_sale_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "graphic_sale_installments_ordinal_check" CHECK ("graphic_sale_installments"."ordinal" > 0)
);
--> statement-breakpoint
CREATE TABLE "graphic_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"os_version_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"competence" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_sales_tenant_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "graphic_sales_positive_amount" CHECK ("graphic_sales"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "graphic_sale_installments" ADD CONSTRAINT "graphic_sale_installments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sale_installments" ADD CONSTRAINT "graphic_sale_installments_sale_tenant_fk" FOREIGN KEY ("organization_id","sale_id") REFERENCES "public"."graphic_sales"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sale_installments" ADD CONSTRAINT "graphic_sale_installments_entry_tenant_fk" FOREIGN KEY ("organization_id","entry_id") REFERENCES "public"."financial_entries"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sales" ADD CONSTRAINT "graphic_sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sales" ADD CONSTRAINT "graphic_sales_os_tenant_fk" FOREIGN KEY ("organization_id","job_id","os_version_id") REFERENCES "public"."graphic_os_versions"("organization_id","job_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sales" ADD CONSTRAINT "graphic_sales_user_tenant_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_sale_installments_ordinal_idx" ON "graphic_sale_installments" USING btree ("organization_id","sale_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_sale_installments_entry_idx" ON "graphic_sale_installments" USING btree ("organization_id","entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_sales_job_idx" ON "graphic_sales" USING btree ("organization_id","job_id");