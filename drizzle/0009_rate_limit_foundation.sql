-- SEC-005: shared PostgreSQL rate-limit buckets.
-- Only HMAC hashes are persisted; raw IPs and user/organization IDs are not stored.
CREATE TABLE "rate_limit_buckets" (
	"key_hash" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_buckets_pk" PRIMARY KEY("key_hash","action","window_start")
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("expires_at");
