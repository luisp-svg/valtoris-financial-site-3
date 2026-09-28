-- Reuse the existing queue; its historical name remains for compatibility.
ALTER TABLE public.insurance_quote_deliveries
 ADD COLUMN delivery_kind text NOT NULL DEFAULT 'insurance_quote' CHECK(delivery_kind IN ('insurance_quote','report_card')),
 ADD COLUMN target_location_id text CHECK(target_location_id IS NULL OR length(btrim(target_location_id)) BETWEEN 1 AND 128),
 ADD COLUMN tag_write_started boolean NOT NULL DEFAULT false,
 ADD COLUMN tag_applied boolean NOT NULL DEFAULT false;
-- Existing quote identities belong to the already configured quote location.
UPDATE public.insurance_quote_deliveries SET target_location_id='I2Y36c45rBLFZhCQwkDC';

CREATE OR REPLACE FUNCTION public.enqueue_insurance_quote_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.lead_type IN ('Auto Insurance Quote','Home Insurance Quote','Commercial Insurance Quote') THEN
  INSERT INTO public.insurance_quote_deliveries(lead_id,delivery_kind,target_location_id)
  VALUES(NEW.id,'insurance_quote','I2Y36c45rBLFZhCQwkDC') ON CONFLICT DO NOTHING;
 ELSIF NEW.assessment_type IN ('family','business','retirement','protection','student_loan','credit','home_buyer')
   AND NEW.consent_snapshot->'contactPermission'='true'::jsonb THEN
  INSERT INTO public.insurance_quote_deliveries(lead_id,delivery_kind) VALUES(NEW.id,'report_card') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
-- No historical Report Card enqueue or replay.
CREATE FUNCTION public.claim_agentcrm_delivery(p_kind text,p_location text,p_lead_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_row public.insurance_quote_deliveries;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('insurance_quote','report_card') OR p_location IS NULL OR length(btrim(p_location)) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'invalid_delivery_target'; END IF;
 -- Preserve the same global lock and lease across both kinds and old quote callers.
 PERFORM pg_advisory_xact_lock(hashtextextended('insurance-quote-delivery',0));
 IF EXISTS(SELECT 1 FROM public.insurance_quote_deliveries WHERE status='processing' AND claimed_at>now()-interval '5 minutes') THEN RETURN NULL; END IF;
 UPDATE public.insurance_quote_deliveries SET status='pending',claim_token=NULL,last_code='lease_expired',updated_at=now()
 WHERE status='processing' AND claimed_at<=now()-interval '5 minutes';
 SELECT q.* INTO v_row FROM public.insurance_quote_deliveries q JOIN public.leads l ON l.id=q.lead_id
 WHERE q.delivery_kind=p_kind AND q.status='pending' AND q.next_attempt_at<=now() AND l.deleted_at IS NULL
 AND (p_lead_id IS NULL OR q.lead_id=p_lead_id)
 AND NOT EXISTS(SELECT 1 FROM public.insurance_quote_deliveries older JOIN public.leads ol ON ol.id=older.lead_id
   WHERE older.lead_id<>q.lead_id AND (ol.household_id=l.household_id
     OR (l.normalized_email IS NOT NULL AND l.normalized_email=ol.normalized_email)
     OR (l.normalized_phone IS NOT NULL AND l.normalized_phone=ol.normalized_phone))
   AND older.status<>'synced' AND (older.contact_create_started OR older.opportunity_create_started OR older.tag_write_started))
 ORDER BY q.created_at,q.lead_id LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v_row.target_location_id IS NOT NULL AND v_row.target_location_id<>p_location THEN
  UPDATE public.insurance_quote_deliveries SET status='held',last_code='location_changed',updated_at=now() WHERE lead_id=v_row.lead_id;
  RETURN NULL;
 END IF;
 UPDATE public.insurance_quote_deliveries SET status='processing',target_location_id=p_location,claim_token=extensions.gen_random_uuid(),claimed_at=now(),attempt_count=attempt_count+1,updated_at=now()
 WHERE lead_id=v_row.lead_id RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END $$;
CREATE OR REPLACE FUNCTION public.claim_insurance_quote_delivery(p_lead_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.claim_agentcrm_delivery('insurance_quote','I2Y36c45rBLFZhCQwkDC',p_lead_id);
$$;
CREATE FUNCTION public.claim_report_card_delivery(p_location text,p_lead_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.claim_agentcrm_delivery('report_card',p_location,p_lead_id);
$$;
CREATE OR REPLACE FUNCTION public.checkpoint_insurance_quote_delivery(p_lead_id uuid,p_token uuid,p_patch jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_patch IS NULL OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
 OR (p_patch-'contact_id'-'opportunity_id'-'contact_create_started'-'opportunity_create_started'-'status'-'last_code'-'tag_write_started'-'tag_applied')<>'{}'::jsonb
 OR (p_patch ? 'status' AND (p_patch->>'status' IS NULL OR p_patch->>'status' NOT IN ('pending','processing','synced','held')))
 OR (p_patch ? 'last_code' AND (p_patch->>'last_code' IS NULL OR p_patch->>'last_code' !~ '^[a-z_]{1,80}$'))
 OR (p_patch ? 'contact_id' AND (p_patch->>'contact_id' IS NULL OR p_patch->>'contact_id' !~ '^[a-zA-Z0-9]{1,128}$'))
 OR (p_patch ? 'opportunity_id' AND (p_patch->>'opportunity_id' IS NULL OR p_patch->>'opportunity_id' !~ '^[a-zA-Z0-9]{1,128}$'))
 THEN RAISE EXCEPTION 'invalid_patch'; END IF;
 UPDATE public.insurance_quote_deliveries SET
 contact_id=coalesce(p_patch->>'contact_id',contact_id),opportunity_id=coalesce(p_patch->>'opportunity_id',opportunity_id),
 contact_create_started=contact_create_started OR coalesce((p_patch->>'contact_create_started')::boolean,false),
 opportunity_create_started=opportunity_create_started OR coalesce((p_patch->>'opportunity_create_started')::boolean,false),
 tag_write_started=tag_write_started OR coalesce((p_patch->>'tag_write_started')::boolean,false),tag_applied=tag_applied OR coalesce((p_patch->>'tag_applied')::boolean,false),
 status=coalesce(p_patch->>'status',status),last_code=coalesce(p_patch->>'last_code',last_code),
 next_attempt_at=CASE WHEN p_patch->>'status'='pending' THEN now()+interval '5 minutes' ELSE next_attempt_at END,updated_at=now()
 WHERE lead_id=p_lead_id AND claim_token=p_token AND status='processing' AND claimed_at>now()-interval '4 minutes 45 seconds'
 AND (p_patch->>'status' IN ('pending','held') OR EXISTS(SELECT 1 FROM public.leads l JOIN public.households h ON h.id=l.household_id WHERE l.id=p_lead_id AND l.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL AND l.consent_snapshot->'contactPermission'='true'::jsonb))
 AND (NOT(p_patch ? 'contact_id') OR contact_id IS NULL OR contact_id=p_patch->>'contact_id')
 AND (NOT(p_patch ? 'opportunity_id') OR opportunity_id IS NULL OR opportunity_id=p_patch->>'opportunity_id');
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_agentcrm_delivery(text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_report_card_delivery(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_report_card_delivery(text,uuid) TO service_role;
-- CREATE OR REPLACE retains existing restricted quote function privileges.
COMMENT ON TABLE public.insurance_quote_deliveries IS 'Shared AgentCRM delivery queue for insurance quotes and consented Report Cards; historical name retained. No copied answers or credentials.';
