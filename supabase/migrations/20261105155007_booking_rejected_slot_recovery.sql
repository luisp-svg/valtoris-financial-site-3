-- Recover definitively rejected calendar requests without replacing a TAC appointment.
CREATE OR REPLACE FUNCTION public.tac_booking_checkpoint(p_submission uuid,p_op text,p_external text DEFAULT NULL,p_status text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE b public.tac_booking_requests;c public.tac_booking_contacts; link text; new_start timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('insurance-quote-delivery',0));
 IF public.tac_booking_state(p_submission) IS NULL THEN RAISE EXCEPTION 'booking_identity_unavailable'; END IF;
 SELECT * INTO STRICT b FROM public.tac_booking_requests WHERE submission_id=p_submission FOR UPDATE;
 SELECT * INTO STRICT c FROM public.tac_booking_contacts WHERE id=b.contact_key FOR UPDATE;
 IF p_op='claim_contact' THEN
  IF EXISTS(SELECT 1 FROM public.insurance_quote_deliveries q JOIN public.leads l ON l.id=q.lead_id
   WHERE (lower(l.normalized_email::text)=c.email OR (c.phone IS NOT NULL AND l.normalized_phone=c.phone))
   AND ((q.status='processing' AND q.claimed_at>now()-interval '5 minutes') OR (q.contact_create_started AND q.contact_id IS NULL))) THEN RETURN false; END IF;
  UPDATE public.tac_booking_contacts SET create_started=true WHERE id=c.id AND NOT create_started AND external_contact_id IS NULL;
  RETURN FOUND;
 ELSIF p_op='claim_event' THEN
  UPDATE public.tac_booking_requests SET create_started=true WHERE id=b.id AND NOT create_started AND external_event_id IS NULL;
  RETURN FOUND;
 ELSIF p_op='reject_event' THEN
  -- Only the server records a definitive rejected POST; timeouts remain uncertain.
  UPDATE public.tac_booking_requests SET create_started=false WHERE id=b.id
   AND state='pending' AND external_event_id IS NULL AND create_started AND c.external_contact_id IS NOT NULL;
  RETURN FOUND;
 ELSIF p_op='reschedule' THEN
  IF b.state<>'pending' OR b.create_started OR b.external_event_id IS NOT NULL THEN RETURN false; END IF;
  new_start:=p_external::timestamptz;
  IF new_start IS NULL OR new_start<=now() OR new_start>now()+interval '90 days'
   OR p_status IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_status)
  THEN RAISE EXCEPTION 'invalid_booking_time'; END IF;
  UPDATE public.tac_booking_requests SET starts_at=new_start,ends_at=new_start+interval '30 minutes',timezone=p_status WHERE id=b.id;
  UPDATE public.appointments SET starts_at=new_start,ends_at=new_start+interval '30 minutes',notes='New consultation time selected; pending AgentCRM confirmation.' WHERE id=b.appointment_id;
  RETURN true;
 ELSIF p_op IN ('link_contact','link_event') THEN
  IF p_external IS NULL OR p_external !~ '^[a-zA-Z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'invalid_external_id'; END IF;
  IF p_op='link_contact' THEN
   INSERT INTO public.integration_contact_links(provider,location_id,external_contact_id,household_member_id)
    VALUES('agentcrm',c.location_id,p_external,c.member_id) ON CONFLICT(provider,location_id,household_member_id) DO NOTHING;
   SELECT external_contact_id INTO STRICT link FROM public.integration_contact_links
    WHERE provider='agentcrm' AND location_id=c.location_id AND household_member_id=c.member_id;
   IF link<>p_external THEN RAISE EXCEPTION 'contact_link_conflict'; END IF;
   UPDATE public.tac_booking_contacts SET external_contact_id=p_external WHERE id=c.id AND (external_contact_id IS NULL OR external_contact_id=p_external);
  ELSE
   IF c.external_contact_id IS NULL THEN RAISE EXCEPTION 'contact_link_missing'; END IF;
   UPDATE public.tac_booking_requests SET external_event_id=p_external,state='confirmed',verified_at=now()
    WHERE id=b.id AND (external_event_id IS NULL OR external_event_id=p_external);
   IF NOT FOUND THEN RAISE EXCEPTION 'event_link_conflict'; END IF;
   UPDATE public.appointments SET external_agentcrm_event_id=p_external,agentcrm_sync_status='confirmed',notes='AgentCRM booking verified. Intake remains in TAC.' WHERE id=b.appointment_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_link_conflict'; END IF;
  RETURN true;
 ELSIF p_op='provider_status' THEN
  IF p_status NOT IN ('confirmed','cancelled','held') OR b.external_event_id IS NULL THEN RAISE EXCEPTION 'invalid_booking_status'; END IF;
  UPDATE public.tac_booking_requests SET state=p_status,verified_at=now() WHERE id=b.id;
  UPDATE public.appointments SET agentcrm_sync_status=p_status,status=CASE WHEN p_status='cancelled' THEN 'cancelled'::public.appointment_status WHEN status='cancelled' THEN 'scheduled'::public.appointment_status ELSE status END WHERE id=b.appointment_id;
  RETURN true;
 END IF;
 RAISE EXCEPTION 'invalid_booking_operation';
END $$;
REVOKE ALL ON FUNCTION public.tac_booking_checkpoint(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tac_booking_checkpoint(uuid,text,text,text) TO service_role;
