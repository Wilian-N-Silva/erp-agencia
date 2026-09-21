CREATE TYPE "public"."graphic_supplier_quote_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "graphic_supplier_quote_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graphic_supplier_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quoted_amount" numeric(14, 2) NOT NULL,
	"quoted_at" timestamp with time zone NOT NULL,
	"estimated_delivery_at" timestamp with time zone,
	"conditions" text,
	"status" "graphic_supplier_quote_status" DEFAULT 'pending' NOT NULL,
	"reviewer_user_id" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_supplier_quotes_positive_amount_check" CHECK ("graphic_supplier_quotes"."quoted_amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_supplier_quotes_organization_id_idx" ON "graphic_supplier_quotes" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_organization_id_idx" ON "files" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "graphic_supplier_quote_attachments" ADD CONSTRAINT "graphic_supplier_quote_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quote_attachments" ADD CONSTRAINT "graphic_supplier_quote_attachments_quote_tenant_fk" FOREIGN KEY ("organization_id","quote_id") REFERENCES "public"."graphic_supplier_quotes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quote_attachments" ADD CONSTRAINT "graphic_supplier_quote_attachments_file_tenant_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."files"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quotes" ADD CONSTRAINT "graphic_supplier_quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quotes" ADD CONSTRAINT "graphic_supplier_quotes_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quotes" ADD CONSTRAINT "graphic_supplier_quotes_job_tenant_fk" FOREIGN KEY ("organization_id","job_id") REFERENCES "public"."graphic_jobs"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quotes" ADD CONSTRAINT "graphic_supplier_quotes_supplier_tenant_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_supplier_quote_attachments_quote_file_idx" ON "graphic_supplier_quote_attachments" USING btree ("quote_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_supplier_quote_attachments_organization_id_idx" ON "graphic_supplier_quote_attachments" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "graphic_supplier_quotes_job_idx" ON "graphic_supplier_quotes" USING btree ("organization_id","job_id","created_at");--> statement-breakpoint
CREATE INDEX "graphic_supplier_quotes_supplier_idx" ON "graphic_supplier_quotes" USING btree ("organization_id","supplier_id");--> statement-breakpoint
CREATE INDEX "graphic_supplier_quotes_status_idx" ON "graphic_supplier_quotes" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "graphic_supplier_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quotes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "graphic_supplier_quotes_tenant_isolation" ON "graphic_supplier_quotes"
FOR ALL TO PUBLIC
USING ("organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "graphic_supplier_quote_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "graphic_supplier_quote_attachments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "graphic_supplier_quote_attachments_tenant_isolation" ON "graphic_supplier_quote_attachments"
FOR ALL TO PUBLIC
USING ("organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid);--> statement-breakpoint

INSERT INTO "permissions" ("key", "description")
VALUES ('graphics.supplier_quote_write', 'Criar e alterar cotacoes de fornecedores da Grafica')
ON CONFLICT ("key") DO UPDATE SET "description" = excluded."description";--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."key" IN ('technical_admin', 'director')
  AND permission."key" = 'graphics.supplier_quote_write'
ON CONFLICT DO NOTHING;
