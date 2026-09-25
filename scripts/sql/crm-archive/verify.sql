-- Synthetic records only; fixtures and all writes rolled back.
BEGIN;
CREATE FUNCTION pg_temp.expect_rejection(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%'||expected||'%' THEN RETURN; END IF;
  RAISE EXCEPTION 'Unexpected rejection: %',SQLERRM;
 END;
 RAISE EXCEPTION 'Expected rejection missing: %',expected;
END $$;
DO $$
DECLARE owner_id uuid; au uuid:=extensions.gen_random_uuid(); ai uuid:=extensions.gen_random_uuid(); h uuid:=extensions.gen_random_uuid(); otherh uuid:=extensions.gen_random_uuid(); c uuid:=extensions.gen_random_uuid(); oldc uuid:=extensions.gen_random_uuid(); pipeline uuid; stage uuid; r jsonb; n integer;
BEGIN
 SELECT id INTO owner_id FROM public.profiles WHERE role='owner' AND is_active AND deleted_at IS NULL LIMIT 1;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Owner fixture context missing'; END IF;
 SELECT p.id,s.id INTO pipeline,stage FROM public.pipelines p JOIN public.pipeline_stages s ON s.pipeline_id=p.id WHERE p.pipeline_type='relationship' ORDER BY s.sort_order LIMIT 1;
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(au,'archive-qa-'||au||'@example.invalid','{"full_name":"Synthetic archive QA"}');
 INSERT INTO public.profiles(id,email,full_name,role) VALUES(au,'archive-qa-'||au||'@example.invalid','Synthetic archive QA','advisor') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.advisor_profiles(id,user_id,display_name,slug) VALUES(ai,au,'Synthetic archive QA','archive-qa-'||ai);
 PERFORM set_config('crm.rpc_context','quick_add_contact',true);
 INSERT INTO public.households(id,display_name,relationship_pipeline_id,relationship_stage_id,assigned_advisor_id,lead_source) VALUES(h,'Synthetic archive QA',pipeline,stage,ai,'manual_contact'),(otherh,'Synthetic other QA',pipeline,stage,NULL,'manual_contact');
 INSERT INTO public.leads(id,household_id,lead_type) VALUES(c,h,'Manual Contact'),(oldc,h,'Manual Contact');
 UPDATE public.leads SET deleted_at=now() WHERE id=oldc;
 PERFORM set_config('crm.rpc_context','',true);
 IF has_function_privilege('anon','public.archive_crm_record(text,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.crm_archive_access(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Invalid grants'; END IF;
 PERFORM pg_temp.expect_rejection(format('SELECT public.archive_crm_record(''household'',%L)',h),'not_authorized');
 PERFORM set_config('request.jwt.claim.sub',au::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',au,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.expect_rejection(format('SELECT public.archive_crm_record(''household'',%L)',otherh),'not_authorized');
 PERFORM pg_temp.expect_rejection(format('SELECT public.restore_crm_record(''lead'',%L)',oldc),'not_recoverable');
 r:=public.archive_crm_record('lead',c);
 IF r->>'id'<>c::text OR r->>'archived'<>'true' THEN RAISE EXCEPTION 'Archive acknowledgement failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.leads WHERE id=c) THEN RAISE EXCEPTION 'Archived row visible via normal RLS'; END IF;
 SELECT count(*) INTO n FROM public.list_archived_crm_records('lead') WHERE id=c;
 IF n<>1 THEN RAISE EXCEPTION 'Recovery list missing row'; END IF;
 PERFORM pg_temp.expect_rejection(format('SELECT public.archive_crm_record(''lead'',%L)',c),'record_unavailable');
 PERFORM public.archive_crm_record('household',h);
 PERFORM pg_temp.expect_rejection(format('SELECT public.restore_crm_record(''lead'',%L)',c),'restore_household_first');
 PERFORM public.restore_crm_record('household',h);
 PERFORM public.restore_crm_record('lead',c);
 IF NOT EXISTS(SELECT 1 FROM public.leads WHERE id=c AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Restore missing'; END IF;
 PERFORM pg_temp.expect_rejection(format('SELECT public.restore_crm_record(''lead'',%L)',c),'not_recoverable');
 PERFORM pg_temp.expect_rejection('SELECT * FROM public.list_archived_crm_records(''lead'',0,101)','invalid_page');
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 UPDATE public.profiles SET is_active=false WHERE id=au;
 PERFORM set_config('request.jwt.claim.sub',au::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.expect_rejection(format('SELECT public.archive_crm_record(''household'',%L)',h),'not_authorized');
 PERFORM pg_temp.expect_rejection('SELECT * FROM public.list_archived_crm_records(''lead'')','not_authorized');
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM public.archive_crm_record('household',otherh);
 PERFORM public.restore_crm_record('household',otherh);
 RESET ROLE;
 IF (SELECT count(*) FROM public.activities WHERE household_id=h AND metadata->>'crm_archive_version'='1')<>2 THEN RAISE EXCEPTION 'Missing audit records'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leads WHERE id=oldc AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Unrelated archived row changed'; END IF;
END $$;
SELECT 'archive recovery security checks passed' AS verification;
ROLLBACK;
