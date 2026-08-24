CREATE FUNCTION "acc_003_prevent_new_employee_user_conflict"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  IF NEW."user_id" IS NULL OR (
    TG_OP = 'UPDATE'
    AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id"
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('acc-003:user:' || NEW."user_id", 0)
  );

  IF EXISTS (
    SELECT 1
    FROM "employees"
    WHERE "user_id" = NEW."user_id"
      AND "id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION
      'User % is already linked to another Employee', NEW."user_id"
      USING
        ERRCODE = '23505',
        CONSTRAINT = 'employees_user_id_one_to_one_guard';
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "acc_003_employee_user_conflict_guard"
BEFORE INSERT OR UPDATE OF "user_id" ON "employees"
FOR EACH ROW
EXECUTE FUNCTION "acc_003_prevent_new_employee_user_conflict"();
