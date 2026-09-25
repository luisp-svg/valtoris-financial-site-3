-- Explicitly approved batch + exact confirmed synthetic household IDs.
-- No hard delete, household cascade, consent changes, or advisor login changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
CREATE TEMP TABLE cleanup_leads ON COMMIT DROP AS
SELECT id,household_id FROM public.leads
WHERE deleted_at IS NULL AND (
 original_source_metadata->>'import_batch_id'='bulk_lead_import_2026_leads_crm_v1'
 OR household_id IN ('2fb5cd83-c086-427e-aded-3d65f1037dff'::uuid,'0958537a-aeba-4992-a930-9d7643fa2b49'::uuid));
DO $$
DECLARE v record; n integer;
BEGIN
 PERFORM 1 FROM public.households h WHERE h.id IN (SELECT household_id FROM cleanup_leads) ORDER BY h.id FOR UPDATE;
 PERFORM 1 FROM public.leads l WHERE l.id IN (SELECT id FROM cleanup_leads) ORDER BY l.id FOR UPDATE;
 SELECT count(*) INTO n FROM public.leads l JOIN cleanup_leads c USING(id) WHERE l.original_source_metadata->>'import_batch_id'='bulk_lead_import_2026_leads_crm_v1';
 IF n<>1493 OR (SELECT count(*) FROM cleanup_leads)<>1500 THEN RAISE EXCEPTION 'Unexpected cleanup count'; END IF;
 IF (SELECT count(*) FROM public.households WHERE deleted_at IS NULL AND ((id='2fb5cd83-c086-427e-aded-3d65f1037dff' AND display_name='SyntheticInsuranceQA Activation20260924') OR (id='0958537a-aeba-4992-a930-9d7643fa2b49' AND display_name='test test')))<>2 THEN RAISE EXCEPTION 'Test identity changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.duplicate_reviews WHERE status='pending' AND incoming_lead_id IN (SELECT id FROM cleanup_leads)) THEN RAISE EXCEPTION 'Pending duplicate review'; END IF;
 IF EXISTS(SELECT 1 FROM public.policies WHERE deleted_at IS NULL AND household_id IN ('2fb5cd83-c086-427e-aded-3d65f1037dff','0958537a-aeba-4992-a930-9d7643fa2b49')) OR EXISTS(SELECT 1 FROM public.opportunities WHERE deleted_at IS NULL AND household_id IN ('2fb5cd83-c086-427e-aded-3d65f1037dff','0958537a-aeba-4992-a930-9d7643fa2b49')) THEN RAISE EXCEPTION 'Test household has business records'; END IF;
 FOR v IN SELECT * FROM cleanup_leads LOOP
  PERFORM public.crm_write_activity(v.household_id,'system','Lead archived','User-approved import and test cleanup; record retained for recovery.',jsonb_build_object('crm_archive_version',1,'record_kind','lead','record_id',v.id,'archived_at',now(),'cleanup_run','2026-09-25-approved-cleanup'),NULL,NULL,v.id,NULL);
 END LOOP;
 UPDATE public.leads SET deleted_at=now() WHERE id IN (SELECT id FROM cleanup_leads) AND deleted_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1500 THEN RAISE EXCEPTION 'Archive count mismatch'; END IF;
 FOR v IN SELECT id FROM public.households WHERE id IN ('2fb5cd83-c086-427e-aded-3d65f1037dff','0958537a-aeba-4992-a930-9d7643fa2b49') LOOP
  PERFORM public.crm_write_activity(v.id,'system','Household archived','User-approved test cleanup; linked history retained.',jsonb_build_object('crm_archive_version',1,'record_kind','household','record_id',v.id,'archived_at',now(),'cleanup_run','2026-09-25-approved-cleanup'));
 END LOOP;
 UPDATE public.households SET deleted_at=now() WHERE id IN ('2fb5cd83-c086-427e-aded-3d65f1037dff','0958537a-aeba-4992-a930-9d7643fa2b49') AND deleted_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'Household count mismatch'; END IF;
END $$;
SELECT count(*) AS archived_leads,(SELECT count(*) FROM public.households WHERE id IN ('2fb5cd83-c086-427e-aded-3d65f1037dff','0958537a-aeba-4992-a930-9d7643fa2b49') AND deleted_at IS NOT NULL) AS archived_test_households FROM public.leads WHERE id IN(SELECT id FROM cleanup_leads) AND deleted_at IS NOT NULL;
COMMIT;
