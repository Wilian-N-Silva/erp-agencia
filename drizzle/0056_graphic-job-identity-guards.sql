-- Preserve existing rows; prevent future divergence between the job, OS and obligations.
CREATE FUNCTION guard_graphic_job_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE linked_finance boolean; linked_os boolean;
BEGIN
  IF NEW.client_id IS NOT DISTINCT FROM OLD.client_id
     AND NOT (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM graphic_sales WHERE organization_id=OLD.organization_id AND job_id=OLD.id)
      OR EXISTS(SELECT 1 FROM graphic_supplier_commitments WHERE organization_id=OLD.organization_id AND job_id=OLD.id)
    INTO linked_finance;
  SELECT EXISTS(SELECT 1 FROM graphic_os_versions WHERE organization_id=OLD.organization_id AND job_id=OLD.id)
    INTO linked_os;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id AND (linked_finance OR linked_os) THEN
    RAISE EXCEPTION 'Graphic job client is protected by historical origins' USING ERRCODE='23514', CONSTRAINT='graphic_job_origin_identity_guard';
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND linked_finance THEN
    RAISE EXCEPTION 'Graphic job financial history must remain accessible' USING ERRCODE='23514', CONSTRAINT='graphic_job_origin_identity_guard';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER graphic_job_origin_identity_guard BEFORE UPDATE OF client_id, deleted_at ON graphic_jobs
FOR EACH ROW EXECUTE FUNCTION guard_graphic_job_identity();
