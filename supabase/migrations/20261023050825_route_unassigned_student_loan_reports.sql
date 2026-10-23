-- The owner requested that every Student Loan Report Card be assigned to Liz.
-- Only current unassigned student-loan leads are changed; household and other-service ownership stay intact.
DO $route$
DECLARE target uuid; lead_row record; previous_context text;
BEGIN
 SELECT id INTO STRICT target FROM public.advisor_profiles
 WHERE slug='lizbeth-350d9c03' AND is_active AND deleted_at IS NULL;
 IF (SELECT count(*) FROM public.leads WHERE assessment_type::text='student_loan' AND assigned_advisor_id IS NULL AND deleted_at IS NULL AND status::text NOT IN('converted','closed_lost','archived'))>100 THEN RAISE EXCEPTION 'student_loan_backfill_exceeds_reviewed_batch'; END IF;
 previous_context:=current_setting('crm.rpc_context',true);
 PERFORM set_config('crm.rpc_context','assign_household',true);
 FOR lead_row IN UPDATE public.leads SET assigned_advisor_id=target,assigned_at=now(),assignment_reason='service_based',
 status=CASE WHEN status::text IN('unassigned','new') THEN 'assigned'::public.lead_status ELSE status END,updated_at=now()
 WHERE assessment_type::text='student_loan' AND assigned_advisor_id IS NULL AND deleted_at IS NULL AND status::text NOT IN('converted','closed_lost','archived')
 RETURNING id,household_id LOOP
  PERFORM public.crm_write_activity(lead_row.household_id,'assignment_changed','Student loan report assigned to Liz',
   'Existing unassigned Student Loan Report Card routed to the student-loan specialist. Household ownership retained.',
   jsonb_build_object('source','student_loan_default_routing_release','to_advisor_id',target),NULL,NULL,lead_row.id,NULL);
 END LOOP;
 PERFORM set_config('crm.rpc_context',coalesce(previous_context,''),true);
END;
$route$;
