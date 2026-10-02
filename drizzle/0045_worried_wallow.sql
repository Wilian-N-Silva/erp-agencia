ALTER TABLE "invoice_request_items" ADD COLUMN "source_time_off_id" uuid;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD COLUMN "sale_base_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD COLUMN "sale_suggested_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD COLUMN "sale_approved_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD COLUMN "sale_approval_note" text;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_request_items" ADD CONSTRAINT "invoice_request_items_source_time_off_id_time_off_requests_id_fk" FOREIGN KEY ("source_time_off_id") REFERENCES "public"."time_off_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_request_items_time_off_idx" ON "invoice_request_items" USING btree ("source_time_off_id");