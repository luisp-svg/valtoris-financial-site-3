-- REVIEW ONLY: not applied to production. Accept both old and adaptive assessment formats.
BEGIN;
CREATE OR REPLACE FUNCTION public.tac_reserve_booking(p_submission uuid,p_location text,p_calendar text,p_start timestamptz,p_timezone text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE l public.leads; a public.assessments; m public.household_members; c public.tac_booking_contacts;
 b public.tac_booking_requests; v_appointment uuid; v_count integer;
BEGIN
 IF p_location IS NULL OR length(p_location) NOT BETWEEN 1 AND 128 OR p_calendar IS NULL OR length(p_calendar) NOT BETWEEN 1 AND 128
 OR p_start IS NULL OR p_start<=now() OR p_start>now()+interval '90 days'
 OR p_timezone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'invalid_booking'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('insurance-quote-delivery',0));
 SELECT * INTO STRICT l FROM public.leads WHERE public_ingest_idempotency_key=p_submission AND deleted_at IS NULL;
 IF l.duplicate_review_status::text='pending' OR l.status::text='duplicate_review'
 OR NOT EXISTS(SELECT 1 FROM public.households WHERE id=l.household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL)
 THEN RAISE EXCEPTION 'identity_review_required'; END IF;
 SELECT count(*) INTO v_count FROM public.assessments WHERE lead_id=l.id AND deleted_at IS NULL AND answers->>'format' IN ('combined-priorities-v1','combined-priorities-v2');
 IF v_count<>1 THEN RAISE EXCEPTION 'assessment_ambiguous'; END IF;
 SELECT * INTO STRICT a FROM public.assessments WHERE lead_id=l.id AND deleted_at IS NULL AND answers->>'format' IN ('combined-priorities-v1','combined-priorities-v2');
 SELECT count(*) INTO v_count FROM public.household_members WHERE household_id=l.household_id AND deleted_at IS NULL
 AND lower(btrim(first_name))=lower(btrim(l.raw_payload->>'firstName')) AND lower(btrim(last_name))=lower(btrim(l.raw_payload->>'lastName'))
 AND lower(normalized_email::text)=lower(l.normalized_email::text) AND normalized_phone IS NOT DISTINCT FROM l.normalized_phone;
 IF v_count<>1 THEN RAISE EXCEPTION 'member_ambiguous'; END IF;
 SELECT * INTO STRICT m FROM public.household_members WHERE household_id=l.household_id AND deleted_at IS NULL
 AND lower(btrim(first_name))=lower(btrim(l.raw_payload->>'firstName')) AND lower(btrim(last_name))=lower(btrim(l.raw_payload->>'lastName'))
 AND lower(normalized_email::text)=lower(l.normalized_email::text) AND normalized_phone IS NOT DISTINCT FROM l.normalized_phone;
 SELECT * INTO b FROM public.tac_booking_requests WHERE submission_id=p_submission;
 IF FOUND THEN
  IF b.calendar_id<>p_calendar OR b.starts_at<>p_start OR b.timezone<>p_timezone THEN RAISE EXCEPTION 'booking_already_reserved'; END IF;
  RETURN b.id;
 END IF;
 INSERT INTO public.tac_booking_contacts(location_id,member_id,email,phone,first_name,last_name,external_contact_id)
 VALUES(p_location,m.id,lower(l.normalized_email::text),l.normalized_phone,m.first_name,m.last_name,
  (SELECT external_contact_id FROM public.integration_contact_links WHERE provider='agentcrm' AND location_id=p_location AND household_member_id=m.id))
 ON CONFLICT(location_id,member_id) DO NOTHING;
 SELECT * INTO STRICT c FROM public.tac_booking_contacts WHERE location_id=p_location AND member_id=m.id;
 IF c.email<>lower(l.normalized_email::text) OR c.phone IS DISTINCT FROM l.normalized_phone THEN RAISE EXCEPTION 'identity_changed'; END IF;
 INSERT INTO public.appointments(household_id,advisor_id,title,starts_at,ends_at,status,notes,agentcrm_location_id,agentcrm_calendar_id,agentcrm_sync_status)
 VALUES(l.household_id,l.assigned_advisor_id,'Valtoris Financial Consultation',p_start,p_start+interval '30 minutes','scheduled',
 'Pending AgentCRM confirmation. Financial priorities and intake remain in TAC.',p_location,p_calendar,'pending') RETURNING id INTO v_appointment;
 INSERT INTO public.tac_booking_requests(submission_id,lead_id,assessment_id,contact_key,appointment_id,calendar_id,starts_at,ends_at,timezone)
 VALUES(p_submission,l.id,a.id,c.id,v_appointment,p_calendar,p_start,p_start+interval '30 minutes',p_timezone) RETURNING id INTO b.id;
 RETURN b.id;
END $$;
COMMIT;
