CREATE TYPE "public"."user_access_status" AS ENUM('pending', 'active', 'suspended', 'revoked');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "is_active" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "access_status" "user_access_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "user"
SET "access_status" = CASE
  WHEN "is_active" THEN 'active'::"user_access_status"
  ELSE 'suspended'::"user_access_status"
END;
