-- Execute inside a transaction with 056 installed; caller must ROLLBACK.
-- Synthetic records only. Any failed invariant aborts the transaction.
DO $$
DECLARE
 p jsonb;
 r jsonb;
 replay jsonb;
 first_household uuid;
 first_lead uuid;
 review_id uuid;
 owner_id uuid;
 k text;
 v_initial_leads bigint;
BEGIN
 IF has_function_privilege('anon','public.ingest_insurance_quote(jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.ingest_insurance_quote(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'public RPC privilege leak'; END IF;
 IF NOT has_function_privilege('service_role','public.ingest_insurance_quote(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'missing server permission'; END IF;
 SELECT count(*) INTO v_initial_leads FROM public.leads;
 FOREACH k IN ARRAY ARRAY['auto','home','commercial'] LOOP
  p:=jsonb_build_object('kind',k,'idempotency_key',extensions.gen_random_uuid(),'fingerprint',repeat('a',64),'first_name','SyntheticInsurance','last_name','RollbackQA','normalized_email','insurance-rollback-'||k||'@example.invalid','normalized_phone',CASE k WHEN 'auto' THEN '+12025550181' WHEN 'home' THEN '+12025550182' ELSE '+12025550183' END,'match_status','new_prospect','raw_payload',jsonb_build_object('quoteKind',k,'quoteAnswers',jsonb_build_object('address','Synthetic test only')),'consent_snapshot',jsonb_build_object('contactPermission',true,'quoteStorageAcknowledged',true,'privacyAcknowledged',true));
  r:=public.ingest_insurance_quote(p);
  IF r->>'created' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'new save failed'; END IF;
  replay:=public.ingest_insurance_quote(p);
  IF replay->>'created' IS DISTINCT FROM 'false' OR replay->>'lead_id' IS DISTINCT FROM r->>'lead_id' THEN RAISE EXCEPTION 'replay failed'; END IF;
  IF (SELECT count(*) FROM public.activities WHERE lead_id=(r->>'lead_id')::uuid) <> 1 THEN RAISE EXCEPTION 'activity duplication'; END IF;
  IF EXISTS(SELECT 1 FROM public.assessments WHERE lead_id=(r->>'lead_id')::uuid) THEN RAISE EXCEPTION 'quote created assessment'; END IF;
  BEGIN
   PERFORM public.ingest_insurance_quote(p || jsonb_build_object('fingerprint',repeat('b',64)));
   RAISE EXCEPTION 'changed request accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
   IF SQLERRM <> 'idempotency_conflict' THEN RAISE; END IF;
  END;
  IF k='auto' THEN first_household:=(r->>'household_id')::uuid; first_lead:=(r->>'lead_id')::uuid; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.leads) <> v_initial_leads+3 THEN RAISE EXCEPTION 'unexpected lead count'; END IF;
 -- Exact known identity links without changing canonical fields.
 p:=p || jsonb_build_object('kind','auto','idempotency_key',extensions.gen_random_uuid(),'normalized_email','insurance-rollback-auto@example.invalid','normalized_phone','+12025550181','match_status','exact_trusted_match','matched_household_id',first_household);
 r:=public.ingest_insurance_quote(p);
 IF (r->>'household_id')::uuid <> first_household THEN RAISE EXCEPTION 'exact match failed'; END IF;
 -- A stale new-prospect classification is rejected before any inserts.
 BEGIN
  PERFORM public.ingest_insurance_quote(p || jsonb_build_object('idempotency_key',extensions.gen_random_uuid(),'match_status','new_prospect'));
  RAISE EXCEPTION 'stale match accepted';
 EXCEPTION WHEN SQLSTATE '40001' THEN IF SQLERRM <> 'retry_match' THEN RAISE; END IF;
 END;
 -- Possible matches create a provisional record and an owner-review entry.
 p:=p || jsonb_build_object('idempotency_key',extensions.gen_random_uuid(),'match_status','possible_match','candidate_household_id',first_household,'first_name','DifferentSynthetic');
 r:=public.ingest_insurance_quote(p);
 review_id:=(r->>'duplicate_review_id')::uuid;
 IF review_id IS NULL OR (r->>'household_id')::uuid=first_household THEN RAISE EXCEPTION 'possible match not isolated'; END IF;
 SELECT id INTO owner_id FROM public.profiles WHERE role='owner' AND is_active=true AND deleted_at IS NULL LIMIT 1;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'QA requires a development owner'; END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 -- Existing guarded resolver and archive work with the new lead types.
 replay:=public.resolve_digital_identity_duplicate_review(review_id,'confirm_same_household','Synthetic transactional QA');
 IF replay->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'resolution failed'; END IF;
 IF (SELECT household_id FROM public.leads WHERE id=(r->>'lead_id')::uuid) <> first_household THEN RAISE EXCEPTION 'resolution did not relink'; END IF;
 replay:=public.archive_intake_lead(first_lead,'test_or_accidental');
 IF replay->>'archived' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'archive failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.activities WHERE lead_id=first_lead AND title='Intake archived') THEN RAISE EXCEPTION 'archive activity missing'; END IF;
END;
$$;
SELECT 'PASS: three quote kinds, replay, changed-payload rejection, exact/possible matching, no assessments, owner resolution, archive, service-only execution' AS result;
