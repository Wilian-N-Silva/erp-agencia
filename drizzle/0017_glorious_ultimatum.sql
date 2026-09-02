CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"masked_identifier" text,
	"opening_balance" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_accounts_type_check" CHECK ("financial_accounts"."type" in ('bank', 'cash', 'card', 'clearing')),
	CONSTRAINT "financial_accounts_status_check" CHECK ("financial_accounts"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"nature" text DEFAULT 'both' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_categories_nature_check" CHECK ("financial_categories"."nature" in ('income', 'expense', 'both'))
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"contact_name" text,
	"email" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD COLUMN "cost_center_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_organization_name_idx" ON "cost_centers" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_organization_code_idx" ON "cost_centers" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_organization_id_idx" ON "cost_centers" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_organization_name_idx" ON "financial_accounts" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "financial_accounts_status_idx" ON "financial_accounts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_categories_organization_name_idx" ON "financial_categories" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_categories_organization_id_idx" ON "financial_categories" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_organization_name_idx" ON "suppliers" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_organization_tax_id_idx" ON "suppliers" USING btree ("organization_id","tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_organization_id_idx" ON "suppliers" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD CONSTRAINT "financial_expenses_supplier_tenant_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD CONSTRAINT "financial_expenses_category_tenant_fk" FOREIGN KEY ("organization_id","category_id") REFERENCES "public"."financial_categories"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD CONSTRAINT "financial_expenses_cost_center_tenant_fk" FOREIGN KEY ("organization_id","cost_center_id") REFERENCES "public"."cost_centers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_expenses_supplier_idx" ON "financial_expenses" USING btree ("organization_id","supplier_id");--> statement-breakpoint
CREATE INDEX "financial_expenses_category_idx" ON "financial_expenses" USING btree ("organization_id","category_id");--> statement-breakpoint
CREATE INDEX "financial_expenses_cost_center_idx" ON "financial_expenses" USING btree ("organization_id","cost_center_id");
--> statement-breakpoint
-- Expand/backfill: preserve the original free-text columns as immutable snapshots
-- while linking exact, organization-scoped master-data matches.
INSERT INTO "suppliers" ("organization_id", "name")
SELECT DISTINCT "organization_id", "supplier"
FROM "financial_expenses"
WHERE btrim("supplier") <> ''
ON CONFLICT ("organization_id", "name") DO NOTHING;--> statement-breakpoint
INSERT INTO "financial_categories" ("organization_id", "name", "nature")
SELECT DISTINCT "organization_id", "category", 'expense'
FROM "financial_expenses"
WHERE btrim("category") <> ''
ON CONFLICT ("organization_id", "name") DO NOTHING;--> statement-breakpoint
INSERT INTO "cost_centers" ("organization_id", "name")
SELECT DISTINCT "organization_id", "cost_center"
FROM "financial_expenses"
WHERE "cost_center" IS NOT NULL AND btrim("cost_center") <> ''
ON CONFLICT ("organization_id", "name") DO NOTHING;--> statement-breakpoint
UPDATE "financial_expenses" AS expense
SET "supplier_id" = supplier."id"
FROM "suppliers" AS supplier
WHERE supplier."organization_id" = expense."organization_id"
  AND supplier."name" = expense."supplier";--> statement-breakpoint
UPDATE "financial_expenses" AS expense
SET "category_id" = category."id"
FROM "financial_categories" AS category
WHERE category."organization_id" = expense."organization_id"
  AND category."name" = expense."category";--> statement-breakpoint
UPDATE "financial_expenses" AS expense
SET "cost_center_id" = cost_center."id"
FROM "cost_centers" AS cost_center
WHERE cost_center."organization_id" = expense."organization_id"
  AND cost_center."name" = expense."cost_center";--> statement-breakpoint
INSERT INTO "audit_logs" (
  "organization_id", "action", "entity_type", "metadata"
)
SELECT
  organization."organization_id",
  'backfill',
  'finance_master_data',
  jsonb_build_object(
    'task', 'FIN-002',
    'expenses', count(*)::int,
    'supplierLinks', count("supplier_id")::int,
    'categoryLinks', count("category_id")::int,
    'costCenterLinks', count("cost_center_id")::int
  )
FROM "financial_expenses" AS organization
GROUP BY organization."organization_id";--> statement-breakpoint

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'cost_centers',
    'financial_accounts',
    'financial_categories',
    'suppliers'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO PUBLIC
       USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)
       WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      tenant_table || '_tenant_isolation',
      tenant_table
    );
  END LOOP;
END
$$;--> statement-breakpoint

INSERT INTO "permissions" ("key", "description")
VALUES ('finance.configure', 'Configurar cadastros financeiros')
ON CONFLICT ("key") DO UPDATE SET "description" = excluded."description";--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."key" IN ('director', 'finance')
  AND permission."key" = 'finance.configure'
ON CONFLICT DO NOTHING;
