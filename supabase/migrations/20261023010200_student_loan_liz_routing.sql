-- Default Student Loan Report Card work to Liz; preserve original advisor attribution.
-- Existing household ownership is retained. Duplicate-review status is retained.
-- No historical backfill. Requires the verified active production advisor identity.
DO $migration$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.ingest_public_report_card(jsonb)'::regprocedure);
 IF strpos(definition, $old$  v_assign_advisor boolean := false;$old$) = 0 THEN RAISE EXCEPTION 'student_loan_routing_writer_changed'; END IF;
 definition := replace(definition, $old$  v_assign_advisor boolean := false;$old$, $new$  v_assign_advisor boolean := false;
  v_student_loan_advisor uuid;$new$);
 IF strpos(definition, $old$  v_activity_lead_title := CASE v_assessment_type$old$) = 0 THEN RAISE EXCEPTION 'student_loan_routing_writer_changed'; END IF;
 definition := replace(definition, $old$  v_activity_lead_title := CASE v_assessment_type$old$, $new$  IF v_assessment_type = 'student_loan' THEN
    SELECT id INTO v_student_loan_advisor FROM public.advisor_profiles
    WHERE slug = 'lizbeth-350d9c03'
      AND deleted_at IS NULL AND is_active = true;
    IF v_student_loan_advisor IS NULL THEN RAISE EXCEPTION 'student_loan_advisor_unavailable'; END IF;
  END IF;

  v_activity_lead_title := CASE v_assessment_type$new$);
 IF strpos(definition, $old$CASE WHEN v_assign_advisor THEN v_advisor_profile_id ELSE NULL END$old$) = 0 THEN RAISE EXCEPTION 'student_loan_routing_writer_changed'; END IF;
 definition := replace(definition, $old$CASE WHEN v_assign_advisor THEN v_advisor_profile_id ELSE NULL END$old$, $new$CASE WHEN v_student_loan_advisor IS NOT NULL THEN v_student_loan_advisor WHEN v_assign_advisor THEN v_advisor_profile_id ELSE NULL END$new$);
 IF strpos(definition, $old$CASE WHEN v_assign_advisor THEN v_submitted_at ELSE NULL END$old$) = 0 THEN RAISE EXCEPTION 'student_loan_routing_writer_changed'; END IF;
 definition := replace(definition, $old$CASE WHEN v_assign_advisor THEN v_submitted_at ELSE NULL END$old$, $new$CASE WHEN v_student_loan_advisor IS NOT NULL OR v_assign_advisor THEN v_submitted_at ELSE NULL END$new$);
 IF strpos(definition, $old$CASE WHEN v_assign_advisor THEN 'advisor_link'::public.assignment_reason ELSE NULL END$old$) = 0 THEN RAISE EXCEPTION 'student_loan_routing_writer_changed'; END IF;
 definition := replace(definition, $old$CASE WHEN v_assign_advisor THEN 'advisor_link'::public.assignment_reason ELSE NULL END$old$, $new$CASE WHEN v_student_loan_advisor IS NOT NULL THEN 'service_based'::public.assignment_reason WHEN v_assign_advisor THEN 'advisor_link'::public.assignment_reason ELSE NULL END$new$);
 IF strpos(definition, $old$    v_lead_status := 'unassigned';$old$) = 0 THEN RAISE EXCEPTION 'student_loan_routing_writer_changed'; END IF;
 definition := replace(definition, $old$    v_lead_status := 'unassigned';$old$, $new$    v_lead_status := CASE WHEN v_student_loan_advisor IS NOT NULL THEN 'assigned'::public.lead_status ELSE 'unassigned'::public.lead_status END;$new$);
 IF strpos(definition, $old$WHEN v_assign_advisor THEN 'assigned'::public.lead_status$old$) = 0 THEN RAISE EXCEPTION 'student_loan_routing_writer_changed'; END IF;
 definition := replace(definition, $old$WHEN v_assign_advisor THEN 'assigned'::public.lead_status$old$, $new$WHEN v_student_loan_advisor IS NOT NULL OR v_assign_advisor THEN 'assigned'::public.lead_status$new$);
 EXECUTE definition;
END;
$migration$;
