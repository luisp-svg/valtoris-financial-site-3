-- Additional service intakes reuse the private assessment lifecycle and person profiles.
CREATE OR REPLACE FUNCTION public.validate_additional_service_intake(p_answers jsonb,p_complete boolean)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,extensions AS $$
DECLARE c jsonb:=public.additional_service_intake_contract(p_answers#>>'{tracks,0}');
BEGIN
 IF c IS NULL OR jsonb_typeof(p_answers->'tracks') IS DISTINCT FROM 'array' OR jsonb_array_length(p_answers->'tracks')<>1 THEN RAISE EXCEPTION 'INTAKE:invalid_service'; END IF;
 PERFORM public.validate_client_intake_contract(p_answers,p_complete,c,ARRAY[]::text[]);
 IF p_complete AND p_answers#>>'{sections,review,0,confirmed}' IS DISTINCT FROM 'Yes' THEN RAISE EXCEPTION 'INTAKE:review_required'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_additional_service_intake(jsonb,boolean) FROM PUBLIC,anon,authenticated;
CREATE POLICY service_intake_active_reader ON public.assessments AS RESTRICTIVE
 FOR SELECT TO authenticated USING (assessment_type <> 'service_intake' OR EXISTS(SELECT 1 FROM public.households h WHERE h.id=assessments.household_id AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL AND (public.crm_is_owner() OR (public.crm_is_advisor() AND h.assigned_advisor_id=public.crm_advisor_id()))));
CREATE POLICY service_intake_insert_rpc_only ON public.assessments AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK (assessment_type <> 'service_intake');
CREATE POLICY service_intake_update_rpc_only ON public.assessments AS RESTRICTIVE
 FOR UPDATE TO authenticated USING (assessment_type <> 'service_intake') WITH CHECK (assessment_type <> 'service_intake');
CREATE POLICY service_intake_delete_blocked ON public.assessments AS RESTRICTIVE
 FOR DELETE TO authenticated USING (assessment_type <> 'service_intake');
CREATE UNIQUE INDEX assessments_service_intake_active_origin_idx ON public.assessments
 (household_id,(derived_metrics#>>'{intake_origin,kind}'),(derived_metrics#>>'{intake_origin,id}'),(derived_metrics->>'service_id'))
 WHERE assessment_type = 'service_intake' AND status = 'draft' AND deleted_at IS NULL;
CREATE INDEX assessments_service_intake_history_idx ON public.assessments(household_id,created_at DESC)
 WHERE assessment_type = 'service_intake' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_service_intake()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.assessment_type = 'service_intake' THEN
   IF TG_OP = 'DELETE' OR OLD.status = 'completed' THEN RAISE EXCEPTION 'INTAKE:preserved_record'; END IF;
   IF NEW.assessment_type <> OLD.assessment_type OR
    (to_jsonb(NEW) - ARRAY['answers','status','completed_at','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['answers','status','completed_at','updated_at']) THEN RAISE EXCEPTION 'INTAKE:immutable_origin'; END IF;
 END IF;
 IF TG_OP <> 'DELETE' AND NEW.assessment_type = 'service_intake' THEN
   IF TG_OP = 'UPDATE' AND OLD.assessment_type <> 'service_intake' THEN RAISE EXCEPTION 'INTAKE:invalid_conversion'; END IF;
   IF current_user IN ('authenticated','anon','service_role') OR current_setting('crm.service_intake_write',true) IS DISTINCT FROM 'save' THEN RAISE EXCEPTION 'INTAKE:rpc_required'; END IF;
   IF NEW.capture_channel <> 'advisor_onboarding' OR NEW.report_token IS NOT NULL OR NEW.report_path IS NOT NULL OR NEW.overall_score IS NOT NULL OR NEW.overall_grade IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INTAKE:private_only'; END IF;
   IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN RAISE EXCEPTION 'INTAKE:save_draft_first'; END IF;
   IF TG_OP = 'UPDATE' THEN NEW.updated_at := greatest(clock_timestamp(),OLD.updated_at + interval '1 microsecond'); END IF;
   IF NEW.derived_metrics->>'service_id' IS DISTINCT FROM NEW.answers#>>'{tracks,0}' THEN RAISE EXCEPTION 'INTAKE:immutable_service'; END IF;
   PERFORM public.validate_additional_service_intake(NEW.answers,NEW.status = 'completed');
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_service_intake() FROM PUBLIC, anon, authenticated;
-- Runs after the existing generic updated_at trigger, preserving a strictly advancing revision.
CREATE TRIGGER assessments_zz_service_intake_guard BEFORE INSERT OR UPDATE OR DELETE ON public.assessments
 FOR EACH ROW EXECUTE FUNCTION public.guard_service_intake();
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
  ELSIF p_type = 'service_intake' THEN
    PERFORM public.validate_additional_service_intake(p_answers,p_complete);
    label:=public.additional_service_intake_contract(p_answers#>>'{tracks,0}')->>'label'; write_context:='crm.service_intake_write';
  ELSE RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  IF auth.uid() IS NULL OR NOT (public.crm_is_owner() OR public.crm_is_advisor())
    OR NOT public.crm_archive_access(p_household_id) THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
  -- Household lock serializes source creation; row revision check catches edits from stale tabs.
  PERFORM 1 FROM public.households WHERE id = p_household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public.crm_archive_access(p_household_id) THEN RAISE EXCEPTION 'INTAKE:unavailable'; END IF;
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
  ELSIF p_type='life_insurance_intake' THEN PERFORM public.validate_life_insurance_intake(p_answers, p_complete); END IF;
  IF p_intake_id IS NULL AND p_complete THEN RAISE EXCEPTION 'INTAKE:save_draft_first'; END IF;
  origin := jsonb_build_object('intake_origin',jsonb_build_object('kind',p_origin_kind,'id',p_origin_id));
  IF p_type='service_intake' THEN origin:=origin||jsonb_build_object('service_id',p_answers#>>'{tracks,0}'); END IF;
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
CREATE OR REPLACE FUNCTION public.save_service_intake(p_household_id uuid,p_origin_kind text,p_origin_id uuid,p_intake_id uuid,p_expected_updated_at timestamptz,p_answers jsonb,p_complete boolean)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
 SELECT public.save_private_client_intake('service_intake',p_household_id,p_origin_kind,p_origin_id,p_intake_id,p_expected_updated_at,p_answers,p_complete);
$$;
REVOKE ALL ON FUNCTION public.save_service_intake(uuid,text,uuid,uuid,timestamptz,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_service_intake(uuid,text,uuid,uuid,timestamptz,jsonb,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
-- One scoped summary read, without downloading intake answers.
CREATE OR REPLACE FUNCTION public.client_intake_progress(p_household_id uuid,p_origin_kind text,p_origin_id uuid)
RETURNS TABLE(type text,status text,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,extensions AS $$
 SELECT DISTINCT ON (coalesce(a.derived_metrics->>'service_id',a.assessment_type::text))
 coalesce(a.derived_metrics->>'service_id',a.assessment_type::text),a.status::text,a.updated_at
 FROM public.assessments a
 WHERE a.household_id=p_household_id AND a.capture_channel='advisor_onboarding' AND a.assessment_type IN ('life_insurance_intake','student_loan_intake','service_intake') AND a.deleted_at IS NULL
 AND a.derived_metrics#>>'{intake_origin,kind}'=p_origin_kind AND a.derived_metrics#>>'{intake_origin,id}'=p_origin_id::text
 AND (public.crm_is_owner() OR public.crm_is_advisor())
 ORDER BY coalesce(a.derived_metrics->>'service_id',a.assessment_type::text),(a.status='draft') DESC,a.updated_at DESC;
$$;
REVOKE ALL ON FUNCTION public.client_intake_progress(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_intake_progress(uuid,text,uuid) TO authenticated;
