ALTER TABLE "graphic_supplier_quotes" DROP CONSTRAINT "graphic_supplier_quotes_reviewer_user_id_user_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "users_organization_id_id_idx" ON "user" USING btree ("organization_id","id");
--> statement-breakpoint
ALTER TABLE "graphic_supplier_quotes" ADD CONSTRAINT "graphic_supplier_quotes_reviewer_tenant_fk" FOREIGN KEY ("organization_id","reviewer_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "permissions" ("key", "description")
VALUES (
	'graphics.supplier_quote_approve',
	'Aprovar ou rejeitar cotacoes de fornecedores da Grafica'
)
ON CONFLICT ("key") DO UPDATE SET "description" = excluded."description";
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."key" IN ('technical_admin', 'director')
	AND permission."key" = 'graphics.supplier_quote_approve'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH jobs_to_reconcile AS (
	SELECT
		job."id",
		job."organization_id",
		to_jsonb(job) AS "before_snapshot"
	FROM "graphic_jobs" AS job
	WHERE job."operational_status" = 'supplier_sourcing'
		AND job."deleted_at" IS NULL
		AND EXISTS (
			SELECT 1
			FROM "graphic_supplier_quotes" AS quote
			WHERE quote."organization_id" = job."organization_id"
				AND quote."job_id" = job."id"
				AND quote."status" = 'pending'
		)
), updated_jobs AS (
	UPDATE "graphic_jobs" AS job
	SET
		"operational_status" = 'supplier_approval_pending',
		"updated_at" = now()
	FROM jobs_to_reconcile AS candidate
	WHERE job."organization_id" = candidate."organization_id"
		AND job."id" = candidate."id"
		AND job."operational_status" = 'supplier_sourcing'
	RETURNING
		job."id",
		job."organization_id",
		to_jsonb(job) AS "after_snapshot"
)
INSERT INTO "audit_logs" (
	"organization_id",
	"action",
	"entity_type",
	"entity_id",
	"before",
	"after",
	"metadata"
)
SELECT
	updated_job."organization_id",
	'status_change',
	'graphic_job',
	updated_job."id"::text,
	candidate."before_snapshot",
	updated_job."after_snapshot",
	jsonb_build_object(
		'backfill', 'GRF-004',
		'reason', 'pending_supplier_quotes'
	)
FROM updated_jobs AS updated_job
INNER JOIN jobs_to_reconcile AS candidate
	ON candidate."organization_id" = updated_job."organization_id"
	AND candidate."id" = updated_job."id";
--> statement-breakpoint
WITH inserted_work_items AS (
	INSERT INTO "work_items" (
		"organization_id",
		"kind",
		"source_type",
		"source_id",
		"occurrence_key",
		"title",
		"description",
		"priority"
	)
	SELECT
		quote."organization_id",
		'graphic_supplier_quote_approval',
		'graphic_supplier_quote',
		quote."id"::text,
		'internal_approval',
		'Aprovar cotacao ' || job."internal_code",
		'Revisar fornecedor, valor e condicoes da cotacao do trabalho ' || job."title" || '.',
		'high'
	FROM "graphic_supplier_quotes" AS quote
	INNER JOIN "graphic_jobs" AS job
		ON job."organization_id" = quote."organization_id"
		AND job."id" = quote."job_id"
	WHERE quote."status" = 'pending'
		AND job."deleted_at" IS NULL
	ON CONFLICT (
		"organization_id",
		"kind",
		"source_type",
		"source_id",
		"occurrence_key"
	) DO NOTHING
	RETURNING *
)
INSERT INTO "audit_logs" (
	"organization_id",
	"action",
	"entity_type",
	"entity_id",
	"after",
	"metadata"
)
SELECT
	work_item."organization_id",
	'create',
	'work_item',
	work_item."id"::text,
	to_jsonb(work_item),
	jsonb_build_object(
		'backfill', 'GRF-004',
		'kind', work_item."kind",
		'sourceType', work_item."source_type",
		'sourceId', work_item."source_id"
	)
FROM inserted_work_items AS work_item;
