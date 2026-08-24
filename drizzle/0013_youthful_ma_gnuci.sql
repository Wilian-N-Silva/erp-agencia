DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "employees"
    WHERE "user_id" IS NOT NULL
    GROUP BY "user_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ACC-003 cannot enforce User-Employee 1:1: duplicate employees.user_id values exist';
  END IF;
END
$$;--> statement-breakpoint
DROP INDEX "employees_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "employees_user_idx" ON "employees" USING btree ("user_id");
