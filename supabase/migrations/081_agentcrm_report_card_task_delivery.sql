-- Approved per-submission task delivery; reuse the existing service-only queue.
-- Additive only: no historical enqueue, status reset, or external task backfill.
ALTER TABLE public.insurance_quote_deliveries
 ADD COLUMN task_id text CHECK(task_id IS NULL OR task_id ~ '^[a-zA-Z0-9]{1,128}$'),
 ADD COLUMN task_create_started boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT report_card_task_scope CHECK (
   (task_id IS NULL AND NOT task_create_started)
   OR (delivery_kind='report_card' AND contact_id IS NOT NULL AND opportunity_id IS NOT NULL
       AND (task_id IS NULL OR task_create_started))
 );
CREATE UNIQUE INDEX agentcrm_delivery_task_identity
 ON public.insurance_quote_deliveries(target_location_id,task_id) WHERE task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_agentcrm_delivery(p_kind text,p_location text,p_lead_id uuid DEFAULT NULL) RETURNS jsonb
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
   AND older.status<>'synced' AND (older.contact_create_started OR older.opportunity_create_started OR older.tag_write_started OR older.task_create_started))
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
CREATE OR REPLACE FUNCTION public.checkpoint_insurance_quote_delivery(p_lead_id uuid,p_token uuid,p_patch jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_patch IS NULL OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
 OR (p_patch-'contact_id'-'opportunity_id'-'contact_create_started'-'opportunity_create_started'-'status'-'last_code'-'tag_write_started'-'tag_applied'-'task_id'-'task_create_started')<>'{}'::jsonb
 OR (p_patch ? 'status' AND (p_patch->>'status' IS NULL OR p_patch->>'status' NOT IN ('pending','processing','synced','held')))
 OR (p_patch ? 'last_code' AND (p_patch->>'last_code' IS NULL OR p_patch->>'last_code' !~ '^[a-z_]{1,80}$'))
 OR (p_patch ? 'contact_id' AND (p_patch->>'contact_id' IS NULL OR p_patch->>'contact_id' !~ '^[a-zA-Z0-9]{1,128}$'))
 OR (p_patch ? 'opportunity_id' AND (p_patch->>'opportunity_id' IS NULL OR p_patch->>'opportunity_id' !~ '^[a-zA-Z0-9]{1,128}$'))
 OR (p_patch ? 'task_id' AND (jsonb_typeof(p_patch->'task_id') IS DISTINCT FROM 'string' OR p_patch->>'task_id' !~ '^[a-zA-Z0-9]{1,128}$'))
 OR (p_patch ? 'task_create_started' AND jsonb_typeof(p_patch->'task_create_started') IS DISTINCT FROM 'boolean')
 THEN RAISE EXCEPTION 'invalid_patch'; END IF;
 UPDATE public.insurance_quote_deliveries SET
 contact_id=coalesce(p_patch->>'contact_id',contact_id),opportunity_id=coalesce(p_patch->>'opportunity_id',opportunity_id),
 contact_create_started=contact_create_started OR coalesce((p_patch->>'contact_create_started')::boolean,false),
 opportunity_create_started=opportunity_create_started OR coalesce((p_patch->>'opportunity_create_started')::boolean,false),
 tag_write_started=tag_write_started OR coalesce((p_patch->>'tag_write_started')::boolean,false),tag_applied=tag_applied OR coalesce((p_patch->>'tag_applied')::boolean,false),
 task_id=coalesce(p_patch->>'task_id',task_id),
 task_create_started=task_create_started OR coalesce((p_patch->>'task_create_started')::boolean,false),
 status=coalesce(p_patch->>'status',status),last_code=coalesce(p_patch->>'last_code',last_code),
 next_attempt_at=CASE WHEN p_patch->>'status'='pending' THEN now()+interval '5 minutes' ELSE next_attempt_at END,updated_at=now()
 WHERE lead_id=p_lead_id AND claim_token=p_token AND status='processing' AND claimed_at>now()-interval '4 minutes 45 seconds'
 AND (p_patch->>'status' IN ('pending','held') OR EXISTS(SELECT 1 FROM public.leads l JOIN public.households h ON h.id=l.household_id WHERE l.id=p_lead_id AND l.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL AND l.consent_snapshot->'contactPermission'='true'::jsonb))
 AND (NOT(p_patch ? 'contact_id') OR contact_id IS NULL OR contact_id=p_patch->>'contact_id')
 AND (NOT(p_patch ? 'opportunity_id') OR opportunity_id IS NULL OR opportunity_id=p_patch->>'opportunity_id')
 AND (NOT(p_patch ? 'task_id') OR task_id IS NULL OR task_id=p_patch->>'task_id')
 -- Task fields belong exclusively to Report Card delivery, including no-op patches.
 AND (NOT(p_patch ?| ARRAY['task_id','task_create_started']) OR (
   delivery_kind='report_card'
   AND coalesce(p_patch->>'contact_id',contact_id) IS NOT NULL
   AND coalesce(p_patch->>'opportunity_id',opportunity_id) IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.leads l JOIN public.households h ON h.id=l.household_id
     WHERE l.id=p_lead_id AND l.deleted_at IS NULL AND h.deleted_at IS NULL
     AND h.merged_into_household_id IS NULL AND l.consent_snapshot->'contactPermission'='true'::jsonb)
 ))
 AND (NOT(p_patch ? 'task_id') OR task_create_started OR p_patch->'task_create_started'='true'::jsonb)
 -- An older worker cannot mark an unresolved task attempt successful.
 AND (p_patch->>'status' IS DISTINCT FROM 'synced'
   OR NOT(task_create_started OR coalesce((p_patch->>'task_create_started')::boolean,false))
   OR coalesce(p_patch->>'task_id',task_id) IS NOT NULL);
 RETURN FOUND;
END $$;
-- CREATE OR REPLACE retains restricted grants. No RLS or ownership changes.
COMMENT ON COLUMN public.insurance_quote_deliveries.task_id IS
 'Verified AgentCRM task ID for this submission; immutable through checkpoint RPC.';
COMMENT ON COLUMN public.insurance_quote_deliveries.task_create_started IS
 'Durable write intent; unknown task outcomes must be reconciled or held, never blindly retried.';
