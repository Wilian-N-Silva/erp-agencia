CREATE TABLE "graphic_reconciliation_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	CONSTRAINT "graphic_reconciliation_suggestions_amount_check" CHECK ("graphic_reconciliation_suggestions"."amount" > 0),
	CONSTRAINT "graphic_reconciliation_suggestions_state_check" CHECK (("graphic_reconciliation_suggestions"."status" = 'pending' and "graphic_reconciliation_suggestions"."reviewed_by_user_id" is null and "graphic_reconciliation_suggestions"."reviewed_at" is null and "graphic_reconciliation_suggestions"."review_notes" is null) or ("graphic_reconciliation_suggestions"."status" in ('accepted','rejected') and "graphic_reconciliation_suggestions"."reviewed_by_user_id" is not null and "graphic_reconciliation_suggestions"."reviewed_at" is not null and "graphic_reconciliation_suggestions"."review_notes" is not null))
);
--> statement-breakpoint
ALTER TABLE "graphic_reconciliation_suggestions" ADD CONSTRAINT "graphic_reconciliation_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_reconciliation_suggestions" ADD CONSTRAINT "graphic_reconciliation_suggestions_job_fk" FOREIGN KEY ("organization_id","job_id") REFERENCES "public"."graphic_jobs"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_reconciliation_suggestions" ADD CONSTRAINT "graphic_reconciliation_suggestions_transaction_fk" FOREIGN KEY ("organization_id","transaction_id") REFERENCES "public"."financial_transactions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_reconciliation_suggestions" ADD CONSTRAINT "graphic_reconciliation_suggestions_entry_fk" FOREIGN KEY ("organization_id","entry_id") REFERENCES "public"."financial_entries"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_reconciliation_suggestions" ADD CONSTRAINT "graphic_reconciliation_suggestions_author_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_reconciliation_suggestions" ADD CONSTRAINT "graphic_reconciliation_suggestions_reviewer_fk" FOREIGN KEY ("organization_id","reviewed_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_reconciliation_suggestions_pending_idx" ON "graphic_reconciliation_suggestions" USING btree ("organization_id","transaction_id","entry_id") WHERE "graphic_reconciliation_suggestions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "graphic_reconciliation_suggestions_job_idx" ON "graphic_reconciliation_suggestions" USING btree ("organization_id","job_id");