ALTER TABLE "access_records" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "access_records"
SET "status_changed_at" = CASE
	WHEN "status" = 'removed' THEN coalesce("removed_at", "updated_at", "created_at")
	ELSE "created_at"
END;--> statement-breakpoint
UPDATE "work_items" AS "work_item"
SET "occurrence_key" = "work_item"."occurrence_key"
	|| ':active_cycle:'
	|| to_char(
		"access_record"."status_changed_at" AT TIME ZONE 'UTC',
		'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
	)
FROM "access_records" AS "access_record"
WHERE "work_item"."organization_id" = "access_record"."organization_id"
	AND "work_item"."kind" = 'access_revocation'
	AND "work_item"."source_type" = 'access_record'
	AND "work_item"."source_id" = "access_record"."id"::text
	AND "work_item"."occurrence_key" NOT LIKE '%:active_cycle:%';--> statement-breakpoint
ALTER TABLE "access_records" ALTER COLUMN "status_changed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "access_records" ALTER COLUMN "status_changed_at" SET NOT NULL;
