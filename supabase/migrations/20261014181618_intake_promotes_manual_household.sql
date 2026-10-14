-- Preserve intake authorization, revision checks and write contexts.
-- Promotes only active Manual Contact leads; existing prospects/clients are unchanged.
CREATE OR REPLACE FUNCTION public.save_private_client_intake(
  p_type public.assessment_type,
  p_household_id uuid, p_origin_kind text, p_origin_id uuid,
  p_intake_id uuid, p_expected_updated_at timestamptz, p_answers jsonb, p_complete boolean
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  row public.assessments%ROWTYPE; source_lead uuid; origin jsonb; label text; write_context text; active_prospect_stage uuid;
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
  -- A successfully saved private service intake establishes a service prospect.
  -- Keep networking-only Manual Contacts hidden until an intake is persisted.
  -- Promotion uses the existing authorized stage RPC and is atomic with this save.
  IF EXISTS (SELECT 1 FROM public.households h
    WHERE h.id = p_household_id AND h.lead_source = 'manual_contact'
      AND h.status = 'lead' AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL) THEN
    SELECT s.id INTO active_prospect_stage FROM public.pipeline_stages s
      JOIN public.households h ON h.relationship_pipeline_id = s.pipeline_id
      WHERE h.id = p_household_id AND s.code = 'active_prospect';
    IF active_prospect_stage IS NULL THEN
      RAISE EXCEPTION 'INTAKE:active_prospect_stage_unavailable';
    END IF;
    PERFORM public.move_household_stage(p_household_id, active_prospect_stage);
  END IF;
  RETURN to_jsonb(row);
END;
$$;
