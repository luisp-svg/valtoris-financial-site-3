-- Life Insurance planning phase approved by Luis after reviewing LIFE_INSURANCE_INTAKE_PHASE_ONE_PLAN.md.
-- Share validation and persistence without changing existing Student Loan sources or records.
CREATE OR REPLACE FUNCTION public.validate_client_intake_contract(p_answers jsonb, p_complete boolean, p_contract jsonb, p_required_rows text[])
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  c jsonb := p_contract;
  s jsonb; f jsonb; r jsonb; rows jsonb; v text; active boolean; parsed_date date;
BEGIN
  IF p_complete IS NULL OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
     OR octet_length(p_answers::text) > 750000
     OR p_answers->'version' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(p_answers->'tracks') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_answers->'sections') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INTAKE:invalid_structure';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_answers) k WHERE k NOT IN ('version','tracks','sections'))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers->'tracks') t WHERE NOT (c->'tracks' @> jsonb_build_array(t)))
     OR (SELECT count(*) <> count(DISTINCT t) FROM jsonb_array_elements(p_answers->'tracks') t)
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_answers->'sections') k WHERE NOT EXISTS
       (SELECT 1 FROM jsonb_array_elements(c->'sections') x WHERE x->>'id' = k)) THEN
    RAISE EXCEPTION 'INTAKE:invalid_structure';
  END IF;
  IF p_complete AND (jsonb_array_length(p_answers->'tracks') = 0
    OR p_answers#>>'{sections,client,0,confirmed}' IS DISTINCT FROM 'Yes') THEN
    RAISE EXCEPTION 'INTAKE:incomplete';
  END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(c->'sections') LOOP
    rows := p_answers->'sections'->(s->>'id');
    IF jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INTAKE:invalid_records'; END IF;
    IF jsonb_array_length(rows) > 50 OR (NOT coalesce((s->>'repeatable')::boolean,false) AND jsonb_array_length(rows) <> 1) THEN
      RAISE EXCEPTION 'INTAKE:invalid_records';
    END IF;
    active := s->>'track' IS NULL OR p_answers->'tracks' ? (s->>'track');
    IF p_complete AND active AND s->>'id' = ANY(p_required_rows) AND jsonb_array_length(rows) = 0 THEN
      RAISE EXCEPTION 'INTAKE:incomplete';
    END IF;
    FOR r IN SELECT value FROM jsonb_array_elements(rows) LOOP
      IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INTAKE:invalid_fields'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(r) k WHERE NOT EXISTS
        (SELECT 1 FROM jsonb_array_elements(s->'fields') x WHERE x->>'id' = k)) THEN RAISE EXCEPTION 'INTAKE:invalid_fields'; END IF;
      FOR f IN SELECT value FROM jsonb_array_elements(s->'fields') LOOP
        v := r->>(f->>'id');
        IF jsonb_typeof(r->(f->>'id')) IS DISTINCT FROM 'string'
          OR length(v) > (CASE WHEN f->>'kind' = 'multiline' THEN 2000 ELSE 300 END) THEN
          RAISE EXCEPTION 'INTAKE:invalid_value';
        END IF;
        IF p_complete AND active AND coalesce((f->>'required')::boolean,false) AND btrim(v) = '' THEN RAISE EXCEPTION 'INTAKE:incomplete'; END IF;
        IF v = '' THEN CONTINUE; END IF;
        IF f->>'kind' IN ('number','money') AND v ~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
          IF (f ? 'min' AND v::numeric < (f->>'min')::numeric)
            OR (f ? 'max' AND v::numeric > (f->>'max')::numeric)
            OR (coalesce((f->>'integer')::boolean,false) AND v::numeric <> trunc(v::numeric)) THEN
            RAISE EXCEPTION 'INTAKE:invalid_number';
          END IF;
        END IF;
        CASE f->>'kind'
          WHEN 'select' THEN
            IF NOT (f->'options' ? v) THEN RAISE EXCEPTION 'INTAKE:invalid_option'; END IF;
          WHEN 'money' THEN
            IF v !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'INTAKE:invalid_amount'; END IF;
            IF v::numeric > 100000000 THEN RAISE EXCEPTION 'INTAKE:invalid_amount'; END IF;
          WHEN 'number' THEN
            IF v !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'INTAKE:invalid_number'; END IF;
            IF v::numeric > 1000000 THEN RAISE EXCEPTION 'INTAKE:invalid_number'; END IF;
          WHEN 'email' THEN
            IF v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'INTAKE:invalid_email'; END IF;
          WHEN 'date' THEN
            IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'INTAKE:invalid_date'; END IF;
            BEGIN
              parsed_date := v::date;
              IF to_char(parsed_date,'YYYY-MM-DD') <> v THEN RAISE EXCEPTION 'INTAKE:invalid_date'; END IF;
            EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INTAKE:invalid_date'; END;
          ELSE NULL;
        END CASE;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_client_intake_contract(jsonb, boolean, jsonb, text[]) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.validate_student_loan_intake(p_answers jsonb, p_complete boolean)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
 SELECT public.validate_client_intake_contract(p_answers,p_complete,public.student_loan_intake_contract(),ARRAY['loans','employment','schools']);
$$;
REVOKE ALL ON FUNCTION public.validate_student_loan_intake(jsonb,boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_life_insurance_intake(p_answers jsonb, p_complete boolean)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE r jsonb; s text; v text; group_role text; review jsonb; handoff jsonb; role_row jsonb;
BEGIN
 PERFORM public.validate_client_intake_contract(p_answers,p_complete,public.life_insurance_intake_contract(),ARRAY[]::text[]);
 FOREACH s IN ARRAY ARRAY['insured','dependents'] LOOP
   FOR r IN SELECT value FROM jsonb_array_elements(p_answers->'sections'->s) LOOP
     v := r->>'birthDate';
     IF v <> '' AND (v::date > (now() AT TIME ZONE 'UTC')::date OR v::date < DATE '1900-01-01') THEN RAISE EXCEPTION 'INTAKE:invalid_birth_date'; END IF;
   END LOOP;
 END LOOP;
 FOREACH s IN ARRAY ARRAY['netWorth','liquidNetWorth'] LOOP
   v := p_answers#>>ARRAY['sections','finances','0',s];
   IF v <> '' THEN
     IF v !~ '^-?(0|[1-9][0-9]*)(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'INTAKE:invalid_net_worth'; END IF;
     IF abs(v::numeric) > 100000000 THEN RAISE EXCEPTION 'INTAKE:invalid_net_worth'; END IF;
   END IF;
 END LOOP;
 handoff := p_answers#>'{sections,handoff,0}';
 IF handoff->>'evidenceReference' ~* 'https?://|www\.' THEN RAISE EXCEPTION 'INTAKE:application_link_not_allowed'; END IF;
 IF NOT p_complete THEN RETURN; END IF;
 FOREACH s IN ARRAY ARRAY['owner','payer'] LOOP
   role_row := p_answers#>ARRAY['sections',s,'0'];
   IF role_row->>'sameAsInsured' = 'No' AND (btrim(role_row->>'entityType') = '' OR btrim(role_row->>'name') = '' OR btrim(role_row->>'relationship') = '' OR btrim(role_row->>'reason') = '') THEN RAISE EXCEPTION 'INTAKE:missing_role'; END IF;
   IF role_row->>'sameAsInsured' = 'Yes' AND EXISTS (SELECT 1 FROM jsonb_each_text(role_row) WHERE key <> 'sameAsInsured' AND btrim(value) <> '') THEN RAISE EXCEPTION 'INTAKE:conflicting_role'; END IF;
 END LOOP;
 FOREACH group_role IN ARRAY ARRAY['Primary','Contingent'] LOOP
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers#>'{sections,beneficiaries}') b WHERE b->>'role' = group_role)
     AND (SELECT sum((b->>'percent')::numeric) FROM jsonb_array_elements(p_answers#>'{sections,beneficiaries}') b WHERE b->>'role' = group_role) <> 100 THEN RAISE EXCEPTION 'INTAKE:beneficiary_total'; END IF;
 END LOOP;
 review := p_answers#>'{sections,review,0}';
 IF review->>'beneficiaryStatus' = 'Recorded' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers#>'{sections,beneficiaries}') b WHERE b->>'role'='Primary') THEN RAISE EXCEPTION 'INTAKE:primary_beneficiary_required'; END IF;
 IF review->>'beneficiaryStatus' = 'To be decided' AND jsonb_array_length(p_answers#>'{sections,beneficiaries}') > 0 THEN RAISE EXCEPTION 'INTAKE:beneficiary_status'; END IF;
 IF review->>'coverageStatus' = 'Policies recorded' AND jsonb_array_length(p_answers#>'{sections,coverage}') = 0 THEN RAISE EXCEPTION 'INTAKE:coverage_required'; END IF;
 IF review->>'coverageStatus' = 'No existing coverage' AND jsonb_array_length(p_answers#>'{sections,coverage}') > 0 THEN RAISE EXCEPTION 'INTAKE:coverage_status'; END IF;
 IF (review->>'beneficiaryStatus' = 'To be decided' OR review->>'coverageStatus' = 'Not yet confirmed') AND btrim(review->>'unresolved') = '' THEN RAISE EXCEPTION 'INTAKE:followup_required'; END IF;
 IF review->>'needsReviewed' <> 'Yes' THEN RAISE EXCEPTION 'INTAKE:review_required'; END IF;
 IF (review->>'reviewDate')::date > (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'INTAKE:future_review'; END IF;
 IF handoff->>'status' <> 'Not started' AND (btrim(handoff->>'carrier') = '' OR btrim(handoff->>'product') = '') THEN RAISE EXCEPTION 'INTAKE:missing_handoff'; END IF;
 IF handoff->>'authorization' = 'Recorded with carrier' AND (handoff->>'authorizationDate' = '' OR btrim(handoff->>'evidenceReference') = '') THEN RAISE EXCEPTION 'INTAKE:missing_authorization_evidence'; END IF;
 IF handoff->>'authorizationDate' <> '' AND (handoff->>'authorizationDate')::date > (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'INTAKE:future_authorization'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_life_insurance_intake(jsonb,boolean) FROM PUBLIC, anon, authenticated;

CREATE POLICY life_intake_active_reader ON public.assessments AS RESTRICTIVE
 FOR SELECT TO authenticated USING (assessment_type <> 'life_insurance_intake' OR public.crm_is_owner() OR public.crm_is_advisor());
CREATE POLICY life_intake_insert_rpc_only ON public.assessments AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK (assessment_type <> 'life_insurance_intake');
CREATE POLICY life_intake_update_rpc_only ON public.assessments AS RESTRICTIVE
 FOR UPDATE TO authenticated USING (assessment_type <> 'life_insurance_intake') WITH CHECK (assessment_type <> 'life_insurance_intake');
CREATE POLICY life_intake_delete_blocked ON public.assessments AS RESTRICTIVE
 FOR DELETE TO authenticated USING (assessment_type <> 'life_insurance_intake');
CREATE UNIQUE INDEX assessments_life_intake_active_origin_idx ON public.assessments
 (household_id,(derived_metrics#>>'{intake_origin,kind}'),(derived_metrics#>>'{intake_origin,id}'))
 WHERE assessment_type = 'life_insurance_intake' AND status = 'draft' AND deleted_at IS NULL;
CREATE INDEX assessments_life_intake_history_idx ON public.assessments(household_id,created_at DESC)
 WHERE assessment_type = 'life_insurance_intake' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_life_insurance_intake()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.assessment_type = 'life_insurance_intake' THEN
   IF TG_OP = 'DELETE' OR OLD.status = 'completed' THEN RAISE EXCEPTION 'INTAKE:preserved_record'; END IF;
   IF NEW.assessment_type <> OLD.assessment_type OR
    (to_jsonb(NEW) - ARRAY['answers','status','completed_at','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['answers','status','completed_at','updated_at']) THEN RAISE EXCEPTION 'INTAKE:immutable_origin'; END IF;
 END IF;
 IF TG_OP <> 'DELETE' AND NEW.assessment_type = 'life_insurance_intake' THEN
   IF TG_OP = 'UPDATE' AND OLD.assessment_type <> 'life_insurance_intake' THEN RAISE EXCEPTION 'INTAKE:invalid_conversion'; END IF;
   IF current_user IN ('authenticated','anon','service_role') OR current_setting('crm.life_intake_write',true) IS DISTINCT FROM 'save' THEN RAISE EXCEPTION 'INTAKE:rpc_required'; END IF;
   IF NEW.capture_channel <> 'advisor_onboarding' OR NEW.report_token IS NOT NULL OR NEW.report_path IS NOT NULL OR NEW.overall_score IS NOT NULL OR NEW.overall_grade IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INTAKE:private_only'; END IF;
   IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN RAISE EXCEPTION 'INTAKE:save_draft_first'; END IF;
   IF TG_OP = 'UPDATE' THEN NEW.updated_at := greatest(clock_timestamp(),OLD.updated_at + interval '1 microsecond'); END IF;
   PERFORM public.validate_life_insurance_intake(NEW.answers,NEW.status = 'completed');
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_life_insurance_intake() FROM PUBLIC, anon, authenticated;
-- Runs after the existing generic updated_at trigger, preserving a strictly advancing revision.
CREATE TRIGGER assessments_zz_life_intake_guard BEFORE INSERT OR UPDATE OR DELETE ON public.assessments
 FOR EACH ROW EXECUTE FUNCTION public.guard_life_insurance_intake();
CREATE OR REPLACE FUNCTION public.save_private_client_intake(
  p_type public.assessment_type,
  p_household_id uuid, p_origin_kind text, p_origin_id uuid,
  p_intake_id uuid, p_expected_updated_at timestamptz, p_answers jsonb, p_complete boolean
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  row public.assessments%ROWTYPE; source_lead uuid; origin jsonb; label text; write_context text;
BEGIN
  IF p_type = 'student_loan_intake' THEN label := 'Student Loan'; write_context := 'crm.student_intake_write';
  ELSIF p_type = 'life_insurance_intake' THEN label := 'Life Insurance'; write_context := 'crm.life_intake_write';
  ELSE RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  IF auth.uid() IS NULL OR NOT (public.crm_is_owner() OR public.crm_is_advisor())
    OR NOT public.crm_can_access_household(p_household_id) THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  -- Household lock serializes source creation; row revision check catches edits from stale tabs.
  PERFORM 1 FROM public.households WHERE id = p_household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  IF p_origin_kind = 'contact' THEN
    SELECT id INTO source_lead FROM public.leads WHERE id = p_origin_id AND household_id = p_household_id
      AND lead_type = 'Manual Contact' AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  ELSIF p_origin_kind = 'report_card' THEN
    SELECT lead_id INTO source_lead FROM public.assessments WHERE id = p_origin_id AND household_id = p_household_id
      AND status = 'completed' AND completed_at IS NOT NULL AND capture_channel = 'public_self_report' AND deleted_at IS NULL
      AND assessment_type IN ('family','business','retirement','protection','student_loan','credit','home_buyer') FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  ELSE RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  IF p_type = 'student_loan_intake' THEN PERFORM public.validate_student_loan_intake(p_answers, p_complete);
  ELSE PERFORM public.validate_life_insurance_intake(p_answers, p_complete); END IF;
  IF p_intake_id IS NULL AND p_complete THEN RAISE EXCEPTION 'INTAKE:save_draft_first'; END IF;
  origin := jsonb_build_object('intake_origin',jsonb_build_object('kind',p_origin_kind,'id',p_origin_id));
  IF p_intake_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.assessments
      WHERE household_id = p_household_id AND assessment_type = p_type AND status = 'draft'
      AND deleted_at IS NULL AND derived_metrics = origin) THEN RAISE EXCEPTION 'INTAKE:conflict'; END IF;
    PERFORM set_config(write_context,'save',true);
    INSERT INTO public.assessments(household_id,lead_id,assessment_type,capture_channel,status,completed_at,answers,derived_metrics)
      VALUES(p_household_id,source_lead,p_type,'advisor_onboarding',
        CASE WHEN p_complete THEN 'completed'::public.assessment_status ELSE 'draft'::public.assessment_status END,
        CASE WHEN p_complete THEN now() ELSE NULL END,p_answers,origin) RETURNING * INTO row;
    PERFORM public.crm_write_activity(p_household_id,'system',label || ' intake started',NULL,
      jsonb_build_object('source',p_type),NULL,NULL,source_lead,row.id);
  ELSE
    SELECT * INTO row FROM public.assessments WHERE id = p_intake_id AND household_id = p_household_id
      AND assessment_type = p_type AND capture_channel = 'advisor_onboarding' AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND OR row.derived_metrics IS DISTINCT FROM origin THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
    IF row.status <> 'draft' THEN RAISE EXCEPTION 'INTAKE:preserved_record'; END IF;
    IF p_expected_updated_at IS NULL OR row.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'INTAKE:conflict'; END IF;
    PERFORM set_config(write_context,'save',true);
    UPDATE public.assessments SET answers = p_answers,
      status = CASE WHEN p_complete THEN 'completed'::public.assessment_status ELSE 'draft'::public.assessment_status END,
      completed_at = CASE WHEN p_complete THEN now() ELSE NULL END WHERE id = row.id RETURNING * INTO row;
  END IF;
  PERFORM set_config(write_context,'',true);
  IF p_complete THEN
    PERFORM public.crm_write_activity(p_household_id,'assessment_completed',label || ' intake completed',NULL,
      jsonb_build_object('source',p_type),NULL,NULL,source_lead,row.id);
  END IF;
  RETURN to_jsonb(row);
END;
$$;
REVOKE ALL ON FUNCTION public.save_private_client_intake(public.assessment_type,uuid,text,uuid,uuid,timestamptz,jsonb,boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_student_loan_intake(
 p_household_id uuid, p_origin_kind text, p_origin_id uuid, p_intake_id uuid,
 p_expected_updated_at timestamptz, p_answers jsonb, p_complete boolean
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT public.save_private_client_intake('student_loan_intake',p_household_id,p_origin_kind,p_origin_id,p_intake_id,p_expected_updated_at,p_answers,p_complete);
$$;
REVOKE ALL ON FUNCTION public.save_student_loan_intake(uuid,text,uuid,uuid,timestamptz,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_student_loan_intake(uuid,text,uuid,uuid,timestamptz,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_life_insurance_intake(
 p_household_id uuid, p_origin_kind text, p_origin_id uuid, p_intake_id uuid,
 p_expected_updated_at timestamptz, p_answers jsonb, p_complete boolean
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT public.save_private_client_intake('life_insurance_intake',p_household_id,p_origin_kind,p_origin_id,p_intake_id,p_expected_updated_at,p_answers,p_complete);
$$;
REVOKE ALL ON FUNCTION public.save_life_insurance_intake(uuid,text,uuid,uuid,timestamptz,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_life_insurance_intake(uuid,text,uuid,uuid,timestamptz,jsonb,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
