CREATE TYPE "public"."user_access_status" AS ENUM('pending', 'active', 'suspended', 'revoked');--> statement-breakpoint
-- Expand phase: the pre-ACC-002 writer omits both status fields when consuming an invitation.
ALTER TABLE "user" ADD COLUMN "access_status" "user_access_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "user"
SET "access_status" = CASE
  WHEN "is_active" THEN 'active'::"user_access_status"
  ELSE 'suspended'::"user_access_status"
END;
