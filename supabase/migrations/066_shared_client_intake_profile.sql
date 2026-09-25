-- Explicitly approved shared intake phase. Existing completed assessments remain immutable.
CREATE TABLE public.client_intake_profiles (
 member_id uuid PRIMARY KEY REFERENCES public.household_members(id),
 household_id uuid NOT NULL REFERENCES public.households(id),
 facts jsonb NOT NULL,
 confirmed_by uuid NOT NULL REFERENCES public.profiles(id),
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.client_intake_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_intake_profiles FROM anon,authenticated;
GRANT SELECT ON public.client_intake_profiles TO authenticated;
CREATE POLICY client_intake_profiles_reader ON public.client_intake_profiles FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.households h WHERE h.id=client_intake_profiles.household_id AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL AND (public.crm_is_owner() OR (public.crm_is_advisor() AND h.assigned_advisor_id=public.crm_advisor_id())))
 AND EXISTS(SELECT 1 FROM public.household_members m WHERE m.id=client_intake_profiles.member_id AND m.household_id=client_intake_profiles.household_id AND m.deleted_at IS NULL)
);
CREATE OR REPLACE FUNCTION public.save_client_intake_profile(p_household_id uuid,p_member_id uuid,p_expected_updated_at timestamptz,p_facts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE r public.client_intake_profiles; k text; v text; keys text[]:=ARRAY['firstName','lastName','email','phone','birthDate','address','city','state','postalCode','employmentStatus','employer','occupation','annualIncome','incomeAsOf','preferredLanguage'];
BEGIN
 IF NOT public.crm_archive_access(p_household_id) THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
 PERFORM 1 FROM public.households WHERE id=p_household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT public.crm_archive_access(p_household_id) THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
 PERFORM 1 FROM public.household_members WHERE id=p_member_id AND household_id=p_household_id AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
 IF jsonb_typeof(p_facts) IS DISTINCT FROM 'object' OR octet_length(p_facts::text)>10000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_facts) x WHERE NOT x=ANY(keys)) THEN RAISE EXCEPTION 'INTAKE:invalid_fields'; END IF;
 FOREACH k IN ARRAY keys LOOP
  v:=p_facts->>k;
  IF jsonb_typeof(p_facts->k) IS DISTINCT FROM 'string' OR length(v)>300 THEN RAISE EXCEPTION 'INTAKE:invalid_fields'; END IF;
 END LOOP;
 IF btrim(p_facts->>'firstName')='' OR btrim(p_facts->>'lastName')='' THEN RAISE EXCEPTION 'INTAKE:missing_name'; END IF;
 IF p_facts->>'email'<>'' AND p_facts->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'INTAKE:invalid_email'; END IF;
 FOREACH k IN ARRAY ARRAY['birthDate','incomeAsOf'] LOOP
  v:=p_facts->>k;
  IF v<>'' THEN
   IF v !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(v::date,'YYYY-MM-DD')<>v OR v::date>current_date OR v::date<date '1900-01-01' THEN RAISE EXCEPTION 'INTAKE:invalid_date'; END IF;
  END IF;
 END LOOP;
 v:=p_facts->>'annualIncome';
 IF v<>'' THEN
  IF v !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$' OR v::numeric>100000000 OR p_facts->>'incomeAsOf'='' THEN RAISE EXCEPTION 'INTAKE:invalid_income'; END IF;
 END IF;
 SELECT * INTO r FROM public.client_intake_profiles WHERE member_id=p_member_id FOR UPDATE;
 IF (FOUND AND (r.household_id<>p_household_id OR p_expected_updated_at IS NULL OR r.updated_at<>p_expected_updated_at)) OR (NOT FOUND AND p_expected_updated_at IS NOT NULL) THEN RAISE EXCEPTION 'INTAKE:conflict'; END IF;
 INSERT INTO public.client_intake_profiles(member_id,household_id,facts,confirmed_by) VALUES(p_member_id,p_household_id,p_facts,auth.uid())
 ON CONFLICT(member_id) DO UPDATE SET facts=excluded.facts,confirmed_by=auth.uid(),confirmed_at=clock_timestamp(),updated_at=greatest(clock_timestamp(),public.client_intake_profiles.updated_at+interval '1 microsecond') RETURNING * INTO r;
 PERFORM public.crm_write_activity(p_household_id,'system','Shared client information confirmed',NULL,jsonb_build_object('member_id',p_member_id));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.save_client_intake_profile(uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_client_intake_profile(uuid,uuid,timestamptz,jsonb) TO authenticated;

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
    OR NOT public.crm_archive_access(p_household_id) THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  -- Household lock serializes source creation; row revision check catches edits from stale tabs.
  PERFORM 1 FROM public.households WHERE id = p_household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  IF p_origin_kind = 'member' THEN
    PERFORM 1 FROM public.household_members WHERE id=p_origin_id AND household_id=p_household_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  ELSIF p_origin_kind = 'contact' THEN
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
NOTIFY pgrst, 'reload schema';
