CREATE TABLE "graphic_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"checksum" text NOT NULL,
	"file_name" text NOT NULL,
	"byte_size" integer NOT NULL,
	"mapping" jsonb NOT NULL,
	"status" text DEFAULT 'preview' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_import_batches_tenant_key" UNIQUE("organization_id","id"),
	CONSTRAINT "graphic_import_batches_checksum_check" CHECK ("graphic_import_batches"."checksum" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "graphic_import_batches_size_check" CHECK ("graphic_import_batches"."byte_size" > 0 and "graphic_import_batches"."byte_size" <= 10485760),
	CONSTRAINT "graphic_import_batches_status_check" CHECK ("graphic_import_batches"."status" in ('preview','partial','complete'))
);
--> statement-breakpoint
CREATE TABLE "graphic_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_sheet" text NOT NULL,
	"source_row" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb NOT NULL,
	"classification" text NOT NULL,
	"issues" jsonb NOT NULL,
	"resolution" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"imported_at" timestamp with time zone,
	"job_id" uuid,
	"entry_id" uuid,
	"transaction_id" uuid,
	CONSTRAINT "graphic_import_rows_tenant_key" UNIQUE("organization_id","id"),
	CONSTRAINT "graphic_import_rows_row_check" CHECK ("graphic_import_rows"."source_row" > 0 and "graphic_import_rows"."revision" >= 0),
	CONSTRAINT "graphic_import_rows_kind_check" CHECK ("graphic_import_rows"."kind" in ('sales','outgoing','incoming')),
	CONSTRAINT "graphic_import_rows_classification_check" CHECK ("graphic_import_rows"."classification" in ('clear','ambiguous','invalid')),
	CONSTRAINT "graphic_import_rows_status_check" CHECK ("graphic_import_rows"."status" in ('pending','ready','imported','ignored'))
);
--> statement-breakpoint
ALTER TABLE "graphic_import_batches" ADD CONSTRAINT "graphic_import_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_import_batches" ADD CONSTRAINT "graphic_import_batches_author_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_import_rows" ADD CONSTRAINT "graphic_import_rows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_import_rows" ADD CONSTRAINT "graphic_import_rows_batch_fk" FOREIGN KEY ("organization_id","batch_id") REFERENCES "public"."graphic_import_batches"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_import_rows" ADD CONSTRAINT "graphic_import_rows_reviewer_fk" FOREIGN KEY ("organization_id","reviewed_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_import_rows" ADD CONSTRAINT "graphic_import_rows_job_fk" FOREIGN KEY ("organization_id","job_id") REFERENCES "public"."graphic_jobs"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_import_rows" ADD CONSTRAINT "graphic_import_rows_entry_fk" FOREIGN KEY ("organization_id","entry_id") REFERENCES "public"."financial_entries"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_import_rows" ADD CONSTRAINT "graphic_import_rows_transaction_fk" FOREIGN KEY ("organization_id","transaction_id") REFERENCES "public"."financial_transactions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_import_batches_checksum_idx" ON "graphic_import_batches" USING btree ("organization_id","checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_import_rows_source_idx" ON "graphic_import_rows" USING btree ("organization_id","batch_id","kind","source_sheet","source_row");