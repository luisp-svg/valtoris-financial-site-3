-- Explicit review assignments; never transfer household ownership or send communications.
CREATE TABLE public.intake_review_assignments (
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
 review_type text NOT NULL CHECK(review_type IN('family','business','home_buyer','retirement','tsp','health','student_loan','credit','lifestyle','benefits','protection','tax')),
 advisor_id uuid NOT NULL REFERENCES public.advisor_profiles(id),
 assigned_by uuid REFERENCES public.profiles(id),
 reason text NOT NULL CHECK(reason IN('specialty_default','manual')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(lead_id,review_type)
);
CREATE INDEX intake_review_assignee_idx ON public.intake_review_assignments(advisor_id,lead_id);
ALTER TABLE public.intake_review_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.intake_review_assignments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.intake_review_assignments TO authenticated;
GRANT ALL ON public.intake_review_assignments TO service_role;
CREATE POLICY intake_review_assignee_read ON public.intake_review_assignments FOR SELECT TO authenticated
 USING(public.crm_is_owner() OR (public.crm_is_advisor() AND advisor_id=public.crm_advisor_id()));

CREATE FUNCTION public.crm_can_read_assigned_intake(p_household uuid,p_lead uuid DEFAULT NULL,p_appointment uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.crm_is_advisor() AND EXISTS(
 SELECT 1 FROM public.leads l JOIN public.households h ON h.id=l.household_id
 WHERE h.id=p_household AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
 AND l.deleted_at IS NULL AND l.public_ingest_idempotency_key IS NOT NULL
 AND (p_lead IS NULL OR l.id=p_lead)
 AND (p_appointment IS NULL OR EXISTS(SELECT 1 FROM public.tac_booking_requests b WHERE b.lead_id=l.id AND b.appointment_id=p_appointment))
 AND (l.assigned_advisor_id=public.crm_advisor_id() OR EXISTS(
 SELECT 1 FROM public.intake_review_assignments r WHERE r.lead_id=l.id AND r.advisor_id=public.crm_advisor_id())));
$$;
REVOKE ALL ON FUNCTION public.crm_can_read_assigned_intake(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_can_read_assigned_intake(uuid,uuid,uuid) TO authenticated;
CREATE POLICY intake_assigned_lead_read ON public.leads FOR SELECT TO authenticated
 USING(deleted_at IS NULL AND public.crm_can_read_assigned_intake(household_id,id,NULL));
CREATE POLICY intake_assigned_household_summary_read ON public.households FOR SELECT TO authenticated
 USING(deleted_at IS NULL AND merged_into_household_id IS NULL AND public.crm_can_read_assigned_intake(id,NULL,NULL));
CREATE POLICY intake_assigned_public_report_read ON public.assessments FOR SELECT TO authenticated
 USING(deleted_at IS NULL AND assessment_type::text IN('family','business','home_buyer','retirement','tsp','health','student_loan','credit','benefits','protection','tax')
 AND public.crm_can_read_assigned_intake(household_id,lead_id,NULL));
CREATE POLICY intake_assigned_appointment_read ON public.appointments FOR SELECT TO authenticated
 USING(deleted_at IS NULL AND public.crm_can_read_assigned_intake(household_id,NULL,id));

CREATE FUNCTION public.route_public_intake_reviews() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l public.leads; kind text; target uuid; kinds jsonb;
BEGIN
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id AND deleted_at IS NULL AND public_ingest_idempotency_key IS NOT NULL;
 IF NOT FOUND OR NEW.assessment_type::text NOT IN('family','business','home_buyer','retirement','tsp','health','student_loan','credit','benefits','protection','tax') THEN RETURN NEW; END IF;
 kinds:=CASE WHEN NEW.answers->>'format'='combined-priorities-v1' AND jsonb_typeof(NEW.answers->'selected')='array' THEN NEW.answers->'selected' ELSE jsonb_build_array(NEW.assessment_type::text) END;
 FOR kind IN SELECT jsonb_array_elements_text(kinds) LOOP
  IF kind NOT IN('family','business','home_buyer','retirement','tsp','health','student_loan','credit','lifestyle','benefits','protection','tax') THEN CONTINUE; END IF;
  target:=l.assigned_advisor_id;
  IF kind IN('student_loan','health') THEN
   SELECT a.id INTO target FROM public.advisor_profiles a JOIN public.profiles p ON p.id=a.user_id
   WHERE a.slug=CASE WHEN kind='student_loan' THEN 'lizbeth-350d9c03' ELSE 'jazmin-perez' END
   AND a.is_active AND a.deleted_at IS NULL AND p.is_active AND p.deleted_at IS NULL AND p.role IN('owner','advisor');
   IF target IS NULL THEN RAISE EXCEPTION 'intake_specialist_unavailable'; END IF;
  END IF;
  IF target IS NOT NULL THEN
   INSERT INTO public.intake_review_assignments(lead_id,review_type,advisor_id,reason)
    VALUES(l.id,kind,target,'specialty_default') ON CONFLICT(lead_id,review_type) DO NOTHING;
  END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.route_public_intake_reviews() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER route_public_intake_reviews AFTER INSERT ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.route_public_intake_reviews();

CREATE FUNCTION public.assign_intake_submission(p_lead_id uuid,p_advisor_id uuid,p_expected_updated_at timestamptz)
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
 PERFORM public.crm_write_activity(l.household_id,'assignment_changed','Intake submission assigned','Submission and its selected reviews assigned. Household ownership retained.',jsonb_build_object('to_advisor_id',p_advisor_id,'source','assign_intake_submission'),auth.uid(),NULL,l.id,NULL);
 RETURN jsonb_build_object('id',l.id,'assigned_advisor_id',l.assigned_advisor_id,'updated_at',l.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.assign_intake_submission(uuid,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_intake_submission(uuid,uuid,timestamptz) TO authenticated;
