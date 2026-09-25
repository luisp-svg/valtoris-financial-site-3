-- Save a durable draft before completion, making retries resolve to one preserved record.
-- Revision timestamps must change even when two calls occur in the same transaction.
CREATE OR REPLACE FUNCTION public.enforce_student_intake_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.assessment_type = 'student_loan_intake' THEN
    IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN RAISE EXCEPTION 'INTAKE:save_draft_first'; END IF;
    IF TG_OP = 'UPDATE' THEN
      NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_student_intake_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assessments_zz_student_intake_revision BEFORE INSERT OR UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_intake_revision();
