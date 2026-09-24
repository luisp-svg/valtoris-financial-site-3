-- Run after verify.sql with migration 057 installed, inside BEGIN/ROLLBACK.

DO $$
DECLARE q jsonb; v_id uuid; v_token uuid;
BEGIN
 IF has_table_privilege('authenticated','public.insurance_quote_deliveries','SELECT') OR has_table_privilege('anon','public.insurance_quote_deliveries','INSERT') THEN RAISE EXCEPTION 'queue access leak'; END IF;
 IF has_function_privilege('authenticated','public.claim_insurance_quote_delivery(uuid)','EXECUTE') THEN RAISE EXCEPTION 'claim access leak'; END IF;
 SELECT l.id INTO v_id FROM public.leads l JOIN public.insurance_quote_deliveries d ON d.lead_id=l.id WHERE l.normalized_email='insurance-rollback-home@example.invalid' AND l.deleted_at IS NULL LIMIT 1;
 IF v_id IS NULL THEN RAISE EXCEPTION 'atomic enqueue missing'; END IF;
 q:=public.claim_insurance_quote_delivery(v_id);
 IF q IS NULL OR q->>'status'<>'processing' THEN RAISE EXCEPTION 'claim failed'; END IF;
 v_token:=(q->>'claim_token')::uuid;
 IF public.claim_insurance_quote_delivery(NULL) IS NOT NULL THEN RAISE EXCEPTION 'concurrent claim allowed'; END IF;
 IF public.checkpoint_insurance_quote_delivery(v_id,extensions.gen_random_uuid(),jsonb_build_object('status','synced')) THEN RAISE EXCEPTION 'wrong token accepted'; END IF;
 IF NOT public.checkpoint_insurance_quote_delivery(v_id,v_token,jsonb_build_object('contact_create_started',true)) THEN RAISE EXCEPTION 'checkpoint failed'; END IF;
 IF NOT public.checkpoint_insurance_quote_delivery(v_id,v_token,jsonb_build_object('status','synced','contact_id','testContact','opportunity_id','testOpportunity')) THEN RAISE EXCEPTION 'completion failed'; END IF;
 IF public.claim_insurance_quote_delivery(v_id) IS NOT NULL THEN RAISE EXCEPTION 'replayed completed work'; END IF;
END $$;
