-- Keep the activity linked only to this household and lead; actor comes from auth.uid().
CREATE OR REPLACE FUNCTION public.assign_intake_submission(p_lead_id uuid,p_advisor_id uuid,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l public.leads; kind text; kinds jsonb; previous_context text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.crm_is_owner() THEN RAISE EXCEPTION 'only owners can assign submissions' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public.leads WHERE id=p_lead_id AND deleted_at IS NULL AND public_ingest_idempotency_key IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'intake_submission_not_found'; END IF;
 IF p_expected_updated_at IS NULL OR l.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'assignment_changed_reload'; END IF;
 IF l.duplicate_review_status::text='pending' OR l.status::text='duplicate_review' THEN RAISE EXCEPTION 'resolve_duplicate_first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.advisor_profiles a JOIN public.profiles p ON p.id=a.user_id WHERE a.id=p_advisor_id AND a.is_active AND a.deleted_at IS NULL AND p.is_active AND p.deleted_at IS NULL AND p.role IN('owner','advisor')) THEN RAISE EXCEPTION 'advisor not found or inactive'; END IF;
 SELECT CASE WHEN a.answers->>'format'='combined-priorities-v1' AND jsonb_typeof(a.answers->'selected')='array' THEN a.answers->'selected' ELSE jsonb_build_array(a.assessment_type::text) END INTO kinds
 FROM public.assessments a WHERE a.lead_id=l.id AND a.deleted_at IS NULL AND a.assessment_type::text IN('family','business','home_buyer','retirement','tsp','health','student_loan','credit','benefits','protection','tax') ORDER BY a.created_at DESC LIMIT 1;
 IF kinds IS NULL THEN RAISE EXCEPTION 'intake_submission_not_found'; END IF;
 previous_context:=current_setting('crm.rpc_context',true);PERFORM set_config('crm.rpc_context','assign_household',true);
 UPDATE public.leads SET assigned_advisor_id=p_advisor_id,assigned_at=now(),assigned_by_user_id=auth.uid(),assignment_reason='manual',
 status=CASE WHEN status::text IN('new','unassigned') THEN 'assigned'::public.lead_status ELSE status END,updated_at=now() WHERE id=l.id RETURNING * INTO l;
 PERFORM set_config('crm.rpc_context',coalesce(previous_context,''),true);
 FOR kind IN SELECT jsonb_array_elements_text(kinds) LOOP
 INSERT INTO public.intake_review_assignments(lead_id,review_type,advisor_id,assigned_by,reason) VALUES(l.id,kind,p_advisor_id,auth.uid(),'manual')
 ON CONFLICT(lead_id,review_type) DO UPDATE SET advisor_id=EXCLUDED.advisor_id,assigned_by=EXCLUDED.assigned_by,reason='manual',updated_at=now();
 END LOOP;
 PERFORM public.crm_write_activity(l.household_id,'assignment_changed','Intake submission assigned','Submission and its selected reviews assigned. Household ownership retained.',jsonb_build_object('to_advisor_id',p_advisor_id,'source','assign_intake_submission'),NULL,NULL,l.id,NULL);
 RETURN jsonb_build_object('id',l.id,'assigned_advisor_id',l.assigned_advisor_id,'updated_at',l.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.assign_intake_submission(uuid,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_intake_submission(uuid,uuid,timestamptz) TO authenticated;
