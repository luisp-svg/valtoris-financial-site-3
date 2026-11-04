-- Deployment draft only. Apply after review; no remote database changed by this file.
ALTER TABLE public.appointments
 ADD COLUMN agentcrm_location_id text,
 ADD COLUMN agentcrm_calendar_id text,
 ADD COLUMN external_agentcrm_event_id text,
 ADD COLUMN agentcrm_sync_status text CHECK(agentcrm_sync_status IN ('pending','confirmed','held','cancelled'));
CREATE UNIQUE INDEX appointments_agentcrm_event_unique ON public.appointments(agentcrm_location_id,external_agentcrm_event_id)
 WHERE external_agentcrm_event_id IS NOT NULL;

CREATE TABLE public.tac_booking_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 location_id text NOT NULL CHECK(length(location_id) BETWEEN 1 AND 128),
 member_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE RESTRICT,
 email text NOT NULL CHECK(email=lower(btrim(email)) AND position('@' IN email)>1),
 phone text,
 first_name text NOT NULL,last_name text NOT NULL,
 create_started boolean NOT NULL DEFAULT false,
 external_contact_id text,
 UNIQUE(location_id,member_id),UNIQUE(location_id,email),UNIQUE(location_id,external_contact_id)
);
CREATE UNIQUE INDEX tac_booking_phone_unique ON public.tac_booking_contacts(location_id,phone) WHERE phone IS NOT NULL;
CREATE TABLE public.tac_booking_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submission_id uuid NOT NULL UNIQUE,
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
 assessment_id uuid NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE RESTRICT,
 contact_key uuid NOT NULL REFERENCES public.tac_booking_contacts(id) ON DELETE RESTRICT,
 appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE RESTRICT,
 calendar_id text NOT NULL CHECK(length(calendar_id) BETWEEN 1 AND 128),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 timezone text NOT NULL,
 create_started boolean NOT NULL DEFAULT false,
 external_event_id text,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','cancelled','held')),
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(contact_key,calendar_id,starts_at),UNIQUE(external_event_id)
);
ALTER TABLE public.tac_booking_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tac_booking_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tac_booking_contacts,public.tac_booking_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.tac_booking_contacts,public.tac_booking_requests TO service_role;
-- Existing appointments household RLS is retained. Visitors never read these tables directly.

CREATE FUNCTION public.tac_reserve_booking(p_submission uuid,p_location text,p_calendar text,p_start timestamptz,p_timezone text)
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

CREATE FUNCTION public.tac_booking_state(p_submission uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT to_jsonb(b)||jsonb_build_object('location_id',c.location_id,'member_id',c.member_id,'email',c.email,'phone',c.phone,
 'first_name',c.first_name,'last_name',c.last_name,'contact_create_started',c.create_started,'external_contact_id',c.external_contact_id)
 FROM public.tac_booking_requests b JOIN public.tac_booking_contacts c ON c.id=b.contact_key
 JOIN public.leads l ON l.id=b.lead_id AND l.deleted_at IS NULL
 JOIN public.assessments a ON a.id=b.assessment_id AND a.deleted_at IS NULL
 JOIN public.households h ON h.id=l.household_id AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
 JOIN public.household_members m ON m.id=c.member_id AND m.deleted_at IS NULL
 JOIN public.appointments ap ON ap.id=b.appointment_id AND ap.deleted_at IS NULL
 WHERE b.submission_id=p_submission AND l.duplicate_review_status::text<>'pending' AND l.status::text<>'duplicate_review'
 AND c.email=lower(l.normalized_email::text) AND c.phone IS NOT DISTINCT FROM l.normalized_phone
 AND m.household_id=l.household_id AND a.household_id=l.household_id
 AND ap.household_id=l.household_id AND ap.starts_at=b.starts_at AND ap.ends_at=b.ends_at
 AND ap.agentcrm_location_id=c.location_id AND ap.agentcrm_calendar_id=b.calendar_id
 AND lower(btrim(l.raw_payload->>'firstName'))=lower(btrim(c.first_name)) AND lower(btrim(l.raw_payload->>'lastName'))=lower(btrim(c.last_name))
 AND lower(m.normalized_email::text)=c.email AND m.normalized_phone IS NOT DISTINCT FROM c.phone
 AND lower(btrim(m.first_name))=lower(btrim(c.first_name)) AND lower(btrim(m.last_name))=lower(btrim(c.last_name));
$$;

CREATE FUNCTION public.tac_booking_checkpoint(p_submission uuid,p_op text,p_external text DEFAULT NULL,p_status text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE b public.tac_booking_requests;c public.tac_booking_contacts; link text;
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

-- Share the existing delivery lock and protect uncertain booking contact writes
-- from a later insurance/report worker. No legacy rows are replayed or edited.
CREATE FUNCTION public.guard_tac_booking_contact_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='processing' AND NEW.contact_id IS NULL AND EXISTS(
 SELECT 1 FROM public.leads l JOIN public.tac_booking_contacts c
 ON c.email=lower(l.normalized_email::text) OR (c.phone IS NOT NULL AND c.phone=l.normalized_phone)
 WHERE l.id=NEW.lead_id AND c.create_started AND c.external_contact_id IS NULL)
 THEN RAISE EXCEPTION 'booking_contact_review_required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_tac_booking_contact_delivery BEFORE INSERT OR UPDATE ON public.insurance_quote_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.guard_tac_booking_contact_delivery();
-- Combined relaunch assessments use only the booking-owned handoff.
CREATE OR REPLACE FUNCTION public.enqueue_insurance_quote_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.lead_type IN ('Auto Insurance Quote','Home Insurance Quote','Commercial Insurance Quote') THEN
  INSERT INTO public.insurance_quote_deliveries(lead_id,delivery_kind,target_location_id)
   VALUES(NEW.id,'insurance_quote','I2Y36c45rBLFZhCQwkDC') ON CONFLICT DO NOTHING;
 ELSIF NEW.raw_payload->>'tacBookingManaged' IS DISTINCT FROM 'true'
 AND NEW.assessment_type IN ('family','business','retirement','protection','student_loan','credit','home_buyer','health','tsp','benefits','tax')
 AND NEW.consent_snapshot->'contactPermission'='true'::jsonb THEN
  INSERT INTO public.insurance_quote_deliveries(lead_id,delivery_kind) VALUES(NEW.id,'report_card') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tac_reserve_booking(uuid,text,text,timestamptz,text),public.tac_booking_state(uuid),public.tac_booking_checkpoint(uuid,text,text,text),public.guard_tac_booking_contact_delivery() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tac_reserve_booking(uuid,text,text,timestamptz,text),public.tac_booking_state(uuid),public.tac_booking_checkpoint(uuid,text,text,text) TO service_role;
COMMENT ON TABLE public.tac_booking_requests IS 'TAC-first consultation handoff. No outbound messaging, tags, workflow enrollment or copied assessment answers.';

CREATE FUNCTION public.guard_tac_appointment_link() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN
  IF TG_OP='INSERT' THEN
   IF NEW.agentcrm_location_id IS NOT NULL OR NEW.agentcrm_calendar_id IS NOT NULL OR NEW.external_agentcrm_event_id IS NOT NULL OR NEW.agentcrm_sync_status IS NOT NULL THEN RAISE EXCEPTION 'booking_links_server_only'; END IF;
  ELSIF NEW.agentcrm_location_id IS DISTINCT FROM OLD.agentcrm_location_id OR NEW.agentcrm_calendar_id IS DISTINCT FROM OLD.agentcrm_calendar_id
   OR NEW.external_agentcrm_event_id IS DISTINCT FROM OLD.external_agentcrm_event_id OR NEW.agentcrm_sync_status IS DISTINCT FROM OLD.agentcrm_sync_status
   THEN RAISE EXCEPTION 'booking_links_server_only'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_tac_appointment_link BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.guard_tac_appointment_link();
REVOKE ALL ON FUNCTION public.guard_tac_appointment_link() FROM PUBLIC,anon,authenticated;
