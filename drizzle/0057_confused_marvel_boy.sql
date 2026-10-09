CREATE TABLE "financial_legacy_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"financial_entry_id" uuid,
	"financial_expense_id" uuid,
	"request_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"evidence" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_legacy_release_positive" CHECK ("financial_legacy_releases"."amount" > 0),
	CONSTRAINT "financial_legacy_release_target" CHECK (("financial_legacy_releases"."financial_entry_id" is not null) <> ("financial_legacy_releases"."financial_expense_id" is not null)),
	CONSTRAINT "financial_legacy_release_reason" CHECK (length(trim("financial_legacy_releases"."reason")) between 10 and 2000 and length(trim("financial_legacy_releases"."evidence")) between 10 and 2000)
);
--> statement-breakpoint
ALTER TABLE "financial_legacy_releases" ADD CONSTRAINT "financial_legacy_releases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_legacy_releases" ADD CONSTRAINT "financial_legacy_release_entry_tenant_fk" FOREIGN KEY ("organization_id","financial_entry_id") REFERENCES "public"."financial_entries"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_legacy_releases" ADD CONSTRAINT "financial_legacy_release_expense_tenant_fk" FOREIGN KEY ("organization_id","financial_expense_id") REFERENCES "public"."financial_expenses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_legacy_releases" ADD CONSTRAINT "financial_legacy_release_author_tenant_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_legacy_release_request_idx" ON "financial_legacy_releases" USING btree ("organization_id","request_id");--> statement-breakpoint
CREATE INDEX "financial_legacy_release_entry_idx" ON "financial_legacy_releases" USING btree ("organization_id","financial_entry_id");--> statement-breakpoint
CREATE INDEX "financial_legacy_release_expense_idx" ON "financial_legacy_releases" USING btree ("organization_id","financial_expense_id");
--> statement-breakpoint
ALTER TABLE financial_legacy_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_legacy_releases FORCE ROW LEVEL SECURITY;
CREATE POLICY financial_legacy_releases_tenant_isolation ON financial_legacy_releases FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION financial_legacy_reserved(org uuid, entry uuid, expense uuid) RETURNS numeric
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT coalesce((SELECT legacy_settled_amount FROM financial_entries WHERE organization_id=org AND id=entry),
    (SELECT legacy_settled_amount FROM financial_expenses WHERE organization_id=org AND id=expense),0)
    - coalesce((SELECT sum(amount) FROM financial_legacy_releases WHERE organization_id=org
      AND ((entry IS NOT NULL AND financial_entry_id=entry) OR (expense IS NOT NULL AND financial_expense_id=expense))),0)
$$;
--> statement-breakpoint
CREATE FUNCTION guard_financial_legacy_release() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE reserved numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Legacy review history is immutable' USING ERRCODE='55000'; END IF;
  IF NEW.financial_entry_id IS NOT NULL THEN
    PERFORM 1 FROM financial_entries WHERE organization_id=NEW.organization_id AND id=NEW.financial_entry_id
      AND deleted_at IS NULL AND status <> 'cancelled' FOR UPDATE;
  ELSE
    PERFORM 1 FROM financial_expenses WHERE organization_id=NEW.organization_id AND id=NEW.financial_expense_id
      AND deleted_at IS NULL AND status <> 'cancelled' FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Legacy review target is unavailable' USING ERRCODE='23503'; END IF;
  SELECT financial_legacy_reserved(NEW.organization_id, NEW.financial_entry_id, NEW.financial_expense_id) INTO reserved;
  IF NEW.amount > reserved THEN RAISE EXCEPTION 'Legacy release exceeds historical reserve' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER financial_legacy_release_guard BEFORE INSERT OR UPDATE OR DELETE ON financial_legacy_releases
FOR EACH ROW EXECUTE FUNCTION guard_financial_legacy_release();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION fin_004_guard_allocated_title_update() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE allocated_amount numeric;
BEGIN
  IF NEW.legacy_settled_amount IS DISTINCT FROM OLD.legacy_settled_amount THEN
    RAISE EXCEPTION 'Historical settlement baseline is immutable' USING ERRCODE='55000';
  END IF;
  SELECT coalesce(sum(a.amount),0) INTO allocated_amount FROM financial_allocations a
  JOIN financial_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
  WHERE a.organization_id=OLD.organization_id AND t.status <> 'reversed'
    AND ((TG_TABLE_NAME='financial_entries' AND a.financial_entry_id=OLD.id)
      OR (TG_TABLE_NAME='financial_expenses' AND a.financial_expense_id=OLD.id));
  IF allocated_amount + financial_legacy_reserved(OLD.organization_id, CASE WHEN TG_TABLE_NAME='financial_entries' THEN OLD.id END, CASE WHEN TG_TABLE_NAME='financial_expenses' THEN OLD.id END) > NEW.amount THEN
    RAISE EXCEPTION 'financial title amount cannot be lower than its allocations and historical settlement' USING ERRCODE='23514';
  END IF;
  IF allocated_amount + financial_legacy_reserved(OLD.organization_id, CASE WHEN TG_TABLE_NAME='financial_entries' THEN OLD.id END, CASE WHEN TG_TABLE_NAME='financial_expenses' THEN OLD.id END) > 0 AND (NEW.status='cancelled' OR NEW.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'settled financial title cannot be cancelled or deleted' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_financial_allocation_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  transaction_amount numeric;
  transaction_direction text;
  transaction_status text;
  transaction_allocated numeric;
  target_amount numeric;
  target_legacy numeric;
  target_allocated numeric;
BEGIN
  SELECT amount, direction, status
  INTO transaction_amount, transaction_direction, transaction_status
  FROM financial_transactions
  WHERE organization_id = NEW.organization_id AND id = NEW.transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'financial allocation transaction is outside tenant scope'
      USING ERRCODE = '23503';
  END IF;

  IF transaction_status = 'reversed' THEN
    RAISE EXCEPTION 'reversed movement cannot receive allocations' USING ERRCODE='23514';
  END IF;

  SELECT coalesce(sum(amount), 0)
  INTO transaction_allocated
  FROM financial_allocations
  WHERE organization_id = NEW.organization_id
    AND transaction_id = NEW.transaction_id;

  IF transaction_allocated + NEW.amount > transaction_amount THEN
    RAISE EXCEPTION 'financial transaction over-allocation'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.financial_entry_id IS NOT NULL THEN
    IF transaction_direction <> 'in' THEN
      RAISE EXCEPTION 'outgoing transaction cannot be allocated to receivable'
        USING ERRCODE = '23514';
    END IF;

    SELECT amount,
      financial_legacy_reserved(organization_id, id, NULL)
    INTO target_amount, target_legacy
    FROM financial_entries
    WHERE organization_id = NEW.organization_id AND id = NEW.financial_entry_id
      AND deleted_at IS NULL AND status <> 'cancelled'
    FOR UPDATE;

    SELECT coalesce(sum(a.amount), 0) INTO target_allocated
    FROM financial_allocations a JOIN financial_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
    WHERE a.organization_id=NEW.organization_id AND a.financial_entry_id=NEW.financial_entry_id AND t.status <> 'reversed';
  ELSE
    IF transaction_direction <> 'out' THEN
      RAISE EXCEPTION 'incoming transaction cannot be allocated to payable'
        USING ERRCODE = '23514';
    END IF;

    SELECT amount, financial_legacy_reserved(organization_id, NULL, id)
    INTO target_amount, target_legacy
    FROM financial_expenses
    WHERE organization_id = NEW.organization_id AND id = NEW.financial_expense_id
      AND deleted_at IS NULL AND status <> 'cancelled'
    FOR UPDATE;

    SELECT coalesce(sum(a.amount), 0) INTO target_allocated
    FROM financial_allocations a JOIN financial_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
    WHERE a.organization_id=NEW.organization_id AND a.financial_expense_id=NEW.financial_expense_id AND t.status <> 'reversed';
  END IF;

  IF target_amount IS NULL THEN
    RAISE EXCEPTION 'financial allocation target is outside tenant scope or unavailable'
      USING ERRCODE = '23503';
  END IF;

  IF target_legacy + target_allocated + NEW.amount > target_amount THEN
    RAISE EXCEPTION 'financial target over-allocation'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;
