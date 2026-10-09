CREATE TABLE "graphic_sale_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"before_amount" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"before_competence" text NOT NULL,
	"competence" text NOT NULL,
	"before_installments" jsonb NOT NULL,
	"installments" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_sale_revisions_state_check" CHECK ("graphic_sale_revisions"."version" > 0 and "graphic_sale_revisions"."before_amount" > 0 and "graphic_sale_revisions"."amount" > 0 and length(trim("graphic_sale_revisions"."reason")) between 5 and 1000 and "graphic_sale_revisions"."before_competence" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and "graphic_sale_revisions"."competence" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and jsonb_typeof("graphic_sale_revisions"."before_installments")='array' and jsonb_typeof("graphic_sale_revisions"."installments")='array')
);
--> statement-breakpoint
ALTER TABLE "graphic_sale_revisions" ADD CONSTRAINT "graphic_sale_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sale_revisions" ADD CONSTRAINT "graphic_sale_revisions_sale_tenant_fk" FOREIGN KEY ("organization_id","sale_id") REFERENCES "public"."graphic_sales"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sale_revisions" ADD CONSTRAINT "graphic_sale_revisions_user_tenant_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_sale_revisions_version_idx" ON "graphic_sale_revisions" USING btree ("organization_id","sale_id","version");
--> statement-breakpoint
ALTER TABLE graphic_sale_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_sale_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_sale_revisions_tenant_isolation ON graphic_sale_revisions FOR ALL
USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
CREATE TRIGGER graphic_sale_revisions_immutable BEFORE UPDATE OR DELETE ON graphic_sale_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_graphic_sale_mutation();
--> statement-breakpoint
CREATE FUNCTION guard_graphic_sale_revision() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE s record; last_revision record; n integer; snapshot jsonb; item jsonb; entry_row record;
BEGIN
  IF nullif(current_setting('app.organization_id',true),'') IS DISTINCT FROM NEW.organization_id::text THEN
    RAISE EXCEPTION 'Tenant context required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM graphic_sales WHERE organization_id=NEW.organization_id AND id=NEW.sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO last_revision FROM graphic_sale_revisions WHERE organization_id=NEW.organization_id AND sale_id=NEW.sale_id ORDER BY version DESC LIMIT 1;
  IF NEW.version<>coalesce(last_revision.version,0)+1 OR NEW.before_amount<>coalesce(last_revision.amount,s.amount)
    OR NEW.before_competence<>coalesce(last_revision.competence,s.competence) THEN
    RAISE EXCEPTION 'Sale revision sequence and prior state must agree' USING ERRCODE='23514';
  END IF;
  PERFORM e.id FROM financial_entries e JOIN graphic_sale_installments i ON i.organization_id=e.organization_id AND i.entry_id=e.id
    WHERE i.organization_id=NEW.organization_id AND i.sale_id=NEW.sale_id ORDER BY e.id FOR UPDATE OF e;
  SELECT count(*) INTO n FROM graphic_sale_installments WHERE organization_id=NEW.organization_id AND sale_id=NEW.sale_id;
  IF n<1 OR n>60 OR jsonb_typeof(NEW.before_installments)<>'array' OR jsonb_typeof(NEW.installments)<>'array'
    OR jsonb_array_length(NEW.before_installments)<>n OR jsonb_array_length(NEW.installments)<>n THEN
    RAISE EXCEPTION 'All original installment links must be preserved' USING ERRCODE='23514';
  END IF;
  FOREACH snapshot IN ARRAY ARRAY[NEW.before_installments,NEW.installments] LOOP
    IF (SELECT count(DISTINCT x->>'entryId') FROM jsonb_array_elements(snapshot) x)<>n THEN
      RAISE EXCEPTION 'Duplicate installment snapshot' USING ERRCODE='23514';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(snapshot) LOOP
      IF jsonb_typeof(item)<>'object' OR NOT coalesce((item->>'entryId') ~ '^[a-fA-F0-9-]{36}$',false)
        OR NOT coalesce((item->>'amount') ~ '^[0-9]{1,10}\.[0-9]{2}$',false)
        OR NOT coalesce((item->>'dueDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',false)
        OR NOT coalesce((item->>'competence') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$',false)
        OR (SELECT count(*) FROM jsonb_object_keys(item))<>4 THEN
        RAISE EXCEPTION 'Invalid installment snapshot' USING ERRCODE='23514';
      END IF;
      IF (item->>'amount')::numeric<=0 OR (item->>'amount')::numeric>=10000000000 THEN
        RAISE EXCEPTION 'Invalid installment amount' USING ERRCODE='23514';
      END IF;
      PERFORM (item->>'dueDate')::date;
      SELECT e.* INTO entry_row FROM financial_entries e JOIN graphic_sale_installments i ON i.organization_id=e.organization_id AND i.entry_id=e.id
        JOIN graphic_jobs j ON j.organization_id=i.organization_id AND j.id=s.job_id
        WHERE i.organization_id=NEW.organization_id AND i.sale_id=NEW.sale_id AND e.id=(item->>'entryId')::uuid
          AND e.client_id=j.client_id AND j.deleted_at IS NULL;
      IF NOT FOUND OR entry_row.deleted_at IS NOT NULL OR entry_row.status='cancelled' THEN
        RAISE EXCEPTION 'Installment scope or state invalid' USING ERRCODE='23514';
      END IF;
      IF snapshot=NEW.before_installments AND (entry_row.amount<>(item->>'amount')::numeric OR entry_row.due_date<>(item->>'dueDate')::date OR entry_row.competence<>item->>'competence') THEN
        RAISE EXCEPTION 'Prior installment snapshot must match the title' USING ERRCODE='23514';
      END IF;
      IF snapshot=NEW.installments AND item->>'competence'<>NEW.competence THEN
        RAISE EXCEPTION 'Revised competence must agree' USING ERRCODE='23514';
      END IF;
      IF financial_legacy_reserved(NEW.organization_id,entry_row.id,null)>0 OR EXISTS (
        SELECT 1 FROM financial_allocations a JOIN financial_transactions t ON t.organization_id=a.organization_id AND t.id=a.transaction_id
        WHERE a.organization_id=NEW.organization_id AND a.financial_entry_id=entry_row.id AND t.status<>'reversed'
      ) THEN RAISE EXCEPTION 'Settled installments must be reversed or reviewed first' USING ERRCODE='23514'; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(NEW.installments) x)<>NEW.amount THEN
    RAISE EXCEPTION 'Revision amount must equal installment sum' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER graphic_sale_revision_insert_guard BEFORE INSERT ON graphic_sale_revisions
FOR EACH ROW EXECUTE FUNCTION guard_graphic_sale_revision();
--> statement-breakpoint
CREATE FUNCTION validate_graphic_sale_revision_state(org uuid, sale uuid) RETURNS void LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM graphic_sale_revisions WHERE organization_id=org AND sale_id=sale ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r.installments) x LEFT JOIN financial_entries e ON e.organization_id=org AND e.id=(x->>'entryId')::uuid
    WHERE e.id IS NULL OR e.deleted_at IS NOT NULL OR e.status='cancelled' OR e.amount<>(x->>'amount')::numeric
      OR e.due_date<>(x->>'dueDate')::date OR e.competence<>r.competence
      OR e.client_id IS DISTINCT FROM (SELECT j.client_id FROM graphic_sales s JOIN graphic_jobs j ON j.organization_id=s.organization_id AND j.id=s.job_id WHERE s.organization_id=org AND s.id=sale)) THEN
    RAISE EXCEPTION 'Revised sale and receivables must agree' USING ERRCODE='23514';
  END IF;
END $$;
CREATE FUNCTION check_graphic_sale_revision_state() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE link record;
BEGIN
  IF TG_TABLE_NAME='graphic_sale_revisions' THEN PERFORM validate_graphic_sale_revision_state(NEW.organization_id,NEW.sale_id);
  ELSE
    FOR link IN SELECT sale_id FROM graphic_sale_installments WHERE organization_id=NEW.organization_id AND entry_id=NEW.id LOOP
      PERFORM validate_graphic_sale_revision_state(NEW.organization_id,link.sale_id);
    END LOOP;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER graphic_sale_revision_state_guard AFTER INSERT ON graphic_sale_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_graphic_sale_revision_state();
CREATE CONSTRAINT TRIGGER graphic_entry_revision_state_guard AFTER UPDATE ON financial_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_graphic_sale_revision_state();
