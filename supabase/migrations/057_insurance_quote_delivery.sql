-- Approved durable insurance delivery. No credentials or questionnaire copies.
CREATE TABLE public.insurance_quote_deliveries (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','synced','held')),
  contact_id text,
  opportunity_id text,
  contact_create_started boolean NOT NULL DEFAULT false,
  opportunity_create_started boolean NOT NULL DEFAULT false,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  claimed_at timestamptz,
  last_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insurance_quote_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quote_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.insurance_quote_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.insurance_quote_deliveries TO service_role;
CREATE INDEX insurance_quote_deliveries_due ON public.insurance_quote_deliveries(next_attempt_at) WHERE status='pending';

CREATE FUNCTION public.enqueue_insurance_quote_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.lead_type IN ('Auto Insurance Quote','Home Insurance Quote','Commercial Insurance Quote') AND NEW.deleted_at IS NULL THEN
    INSERT INTO public.insurance_quote_deliveries(lead_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_insurance_quote_delivery() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER insurance_quote_delivery_enqueue AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.enqueue_insurance_quote_delivery();
-- Existing requests (including the owner's identified test) remain queued until activation.
INSERT INTO public.insurance_quote_deliveries(lead_id)
SELECT id FROM public.leads WHERE deleted_at IS NULL AND lead_type IN ('Auto Insurance Quote','Home Insurance Quote','Commercial Insurance Quote') ON CONFLICT DO NOTHING;

CREATE FUNCTION public.claim_insurance_quote_delivery(p_lead_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_row public.insurance_quote_deliveries;
BEGIN
  -- One quote worker at a time, including different submissions by the same identity.
  PERFORM pg_advisory_xact_lock(hashtextextended('insurance-quote-delivery',0));
  IF EXISTS(SELECT 1 FROM public.insurance_quote_deliveries WHERE status='processing' AND claimed_at > now()-interval '5 minutes') THEN RETURN NULL; END IF;
  UPDATE public.insurance_quote_deliveries SET status='pending',claim_token=NULL,last_code='lease_expired',updated_at=now()
    WHERE status='processing' AND claimed_at <= now()-interval '5 minutes';
  SELECT q.* INTO v_row FROM public.insurance_quote_deliveries q JOIN public.leads l ON l.id=q.lead_id
    WHERE q.status='pending' AND q.next_attempt_at<=now() AND l.deleted_at IS NULL
    AND (p_lead_id IS NULL OR q.lead_id=p_lead_id)
    AND NOT EXISTS (SELECT 1 FROM public.insurance_quote_deliveries older JOIN public.leads ol ON ol.id=older.lead_id
      WHERE ol.household_id=l.household_id AND older.lead_id<>q.lead_id AND older.created_at<=q.created_at
      AND older.status<>'synced' AND (older.contact_create_started OR older.opportunity_create_started))
    ORDER BY q.created_at,q.lead_id LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.insurance_quote_deliveries SET status='processing',claim_token=extensions.gen_random_uuid(),claimed_at=now(),attempt_count=attempt_count+1,updated_at=now()
    WHERE lead_id=v_row.lead_id RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END; $$;

CREATE FUNCTION public.checkpoint_insurance_quote_delivery(p_lead_id uuid,p_token uuid,p_patch jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR (p_patch-'contact_id'-'opportunity_id'-'contact_create_started'-'opportunity_create_started'-'status'-'last_code') <> '{}'::jsonb
    OR (p_patch ? 'status' AND p_patch->>'status' NOT IN ('pending','processing','synced','held')) THEN RAISE EXCEPTION 'invalid_patch'; END IF;
  UPDATE public.insurance_quote_deliveries SET
    contact_id=COALESCE(p_patch->>'contact_id',contact_id),opportunity_id=COALESCE(p_patch->>'opportunity_id',opportunity_id),
    contact_create_started=contact_create_started OR COALESCE((p_patch->>'contact_create_started')::boolean,false),
    opportunity_create_started=opportunity_create_started OR COALESCE((p_patch->>'opportunity_create_started')::boolean,false),
    status=COALESCE(p_patch->>'status',status),last_code=COALESCE(p_patch->>'last_code',last_code),
    next_attempt_at=CASE WHEN p_patch->>'status'='pending' THEN now()+interval '5 minutes' ELSE next_attempt_at END,updated_at=now()
    WHERE lead_id=p_lead_id AND claim_token=p_token AND status='processing' AND claimed_at>now()-interval '5 minutes';
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.claim_insurance_quote_delivery(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.checkpoint_insurance_quote_delivery(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_insurance_quote_delivery(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkpoint_insurance_quote_delivery(uuid,uuid,jsonb) TO service_role;
