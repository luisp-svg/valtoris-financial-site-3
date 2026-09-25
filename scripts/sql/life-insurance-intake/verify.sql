-- Synthetic fixtures only; every mutation is rolled back, including temporary auth users.
BEGIN;
CREATE FUNCTION pg_temp.expect_rejection(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%' || expected || '%' THEN RETURN; END IF;
    RAISE EXCEPTION 'Unexpected rejection: %', SQLERRM;
  END;
  RAISE EXCEPTION 'Expected rejection missing: %', expected;
END;
$$;
DO $$
DECLARE
 owner_id uuid; advisor_user uuid := extensions.gen_random_uuid(); advisor_id uuid := extensions.gen_random_uuid();
 household uuid := extensions.gen_random_uuid(); other_household uuid := extensions.gen_random_uuid();
 contact uuid := extensions.gen_random_uuid(); report uuid := extensions.gen_random_uuid();
 pipeline uuid; stage uuid; s jsonb; f jsonb; r jsonb; sections jsonb := '{}'; a jsonb; complete_a jsonb;
 saved jsonb; updated jsonb; completed jsonb; new_review jsonb; original_report jsonb;
 cmd text; result_count bigint; affected bigint;
BEGIN
 SELECT id INTO owner_id FROM public.profiles WHERE role='owner' AND is_active AND deleted_at IS NULL LIMIT 1;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Development owner required'; END IF;
 SELECT p.id, ps.id INTO pipeline, stage FROM public.pipelines p JOIN public.pipeline_stages ps ON ps.pipeline_id=p.id WHERE p.pipeline_type='relationship' ORDER BY ps.sort_order LIMIT 1;
 IF pipeline IS NULL THEN RAISE EXCEPTION 'Missing relationship pipeline'; END IF;
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(advisor_user,'intake-qa-'||advisor_user||'@example.invalid','{"full_name":"Synthetic Intake QA"}');
 INSERT INTO public.profiles(id,email,full_name,role) VALUES(advisor_user,'intake-qa-'||advisor_user||'@example.invalid','Synthetic Intake QA','advisor') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.advisor_profiles(id,user_id,display_name,slug) VALUES(advisor_id,advisor_user,'Synthetic Intake QA','intake-qa-'||advisor_id);
 INSERT INTO public.households(id,display_name,relationship_pipeline_id,relationship_stage_id,assigned_advisor_id)
 VALUES(household,'Synthetic Life Intake QA',pipeline,stage,advisor_id),(other_household,'Synthetic Other Household',pipeline,stage,NULL);
 PERFORM set_config('crm.rpc_context','quick_add_contact',true);
 INSERT INTO public.leads(id,household_id,lead_type) VALUES(contact,household,'Manual Contact');
 PERFORM set_config('crm.rpc_context','',true);
 INSERT INTO public.assessments(id,household_id,assessment_type,capture_channel,answers,overall_score,overall_grade)
 VALUES(report,household,'student_loan','public_self_report','{"original":"unchanged"}',75,'C');
 SELECT to_jsonb(x) INTO original_report FROM public.assessments x WHERE id=report;
 FOR s IN SELECT value FROM jsonb_array_elements(public.life_insurance_intake_contract()->'sections') LOOP
   SELECT jsonb_object_agg(value->>'id',''::text) INTO r FROM jsonb_array_elements(s->'fields');
   sections := sections || jsonb_build_object(s->>'id',CASE WHEN coalesce((s->>'repeatable')::boolean,false) THEN '[]'::jsonb ELSE jsonb_build_array(r) END);
 END LOOP;
 a := jsonb_build_object('version',1,'tracks','[]'::jsonb,'sections',sections);
 complete_a := jsonb_set(a,'{tracks}','["Life insurance planning"]');
 FOR s IN SELECT value FROM jsonb_array_elements(public.life_insurance_intake_contract()->'sections') WHERE NOT coalesce((value->>'repeatable')::boolean,false) OR value->>'id'='beneficiaries' LOOP
   SELECT jsonb_object_agg(value->>'id',''::text) INTO r FROM jsonb_array_elements(s->'fields');
   FOR f IN SELECT value FROM jsonb_array_elements(s->'fields') WHERE value->>'required'='true' LOOP
     r := r || jsonb_build_object(f->>'id',CASE f->>'kind' WHEN 'select' THEN f->'options'->>0 WHEN 'email' THEN 'synthetic@example.invalid' WHEN 'date' THEN '2000-01-01' WHEN 'number' THEN '100' ELSE 'Synthetic QA' END);
   END LOOP;
   complete_a := jsonb_set(complete_a,ARRAY['sections',s->>'id'],jsonb_build_array(r));
 END LOOP;
 complete_a := jsonb_set(complete_a,'{sections,review,0,coverageStatus}','"No existing coverage"');
 -- Validation exercises server contract independently of browser validation.
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,true)',jsonb_set(complete_a,'{sections,owner,0,sameAsInsured}','"No"')),'INTAKE:missing_role');
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,false)',jsonb_set(a,'{sections,needs,0,years}','"10.5"')),'INTAKE:invalid_number');
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,false)',jsonb_set(a,'{sections,handoff,0,evidenceReference}','"https://carrier.example/token"')),'INTAKE:application_link_not_allowed');
 PERFORM public.validate_life_insurance_intake(jsonb_set(a,'{sections,finances,0,netWorth}','"-1000"'),false);
 PERFORM public.validate_life_insurance_intake(a,false);
 PERFORM public.validate_life_insurance_intake(complete_a,true);
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,true)',a),'INTAKE:incomplete');
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,false)',jsonb_set(a,'{sections,client,0,ssn}','"not-allowed"')),'INTAKE:invalid_fields');
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,false)',jsonb_set(complete_a,'{sections,insured,0,birthDate}','"2026-02-30"')),'INTAKE:invalid_date');
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,false)',jsonb_set(complete_a,'{sections,needs,0,debt}','"-1"')),'INTAKE:invalid_amount');
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,true)',jsonb_set(complete_a,'{sections,beneficiaries,0,percent}','"90"')),'INTAKE:beneficiary_total');
 PERFORM pg_temp.expect_rejection(format('SELECT public.validate_life_insurance_intake(%L::jsonb,false)',jsonb_set(a,'{tracks}','["Life insurance planning","Life insurance planning"]')),'INTAKE:invalid_structure');
 IF has_function_privilege('authenticated','public.save_private_client_intake(public.assessment_type,uuid,text,uuid,uuid,timestamptz,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Internal writer exposed'; END IF;
 IF has_function_privilege('anon','public.save_life_insurance_intake(uuid,text,uuid,uuid,timestamptz,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous save allowed'; END IF;
 IF has_function_privilege('authenticated','public.validate_life_insurance_intake(jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Internal validator exposed'; END IF;
 cmd := format('SELECT public.save_life_insurance_intake(%L,''contact'',%L,NULL,NULL,%L::jsonb,false)',household,contact,a);
 PERFORM pg_temp.expect_rejection(cmd,'INTAKE:unavailable');
 PERFORM set_config('request.jwt.claim.sub',advisor_user::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',advisor_user,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 saved := public.save_life_insurance_intake(household,'contact',contact,NULL,NULL,a,false);
 IF saved->>'status' <> 'draft' OR saved->>'completed_at' IS NOT NULL THEN RAISE EXCEPTION 'Draft status incorrect'; END IF;
 PERFORM pg_temp.expect_rejection(cmd,'INTAKE:conflict');
 PERFORM pg_temp.expect_rejection(format('SELECT public.save_life_insurance_intake(%L,''contact'',%L,NULL,NULL,%L::jsonb,false)',other_household,contact,a),'INTAKE:unavailable');
 PERFORM pg_temp.expect_rejection(format('SELECT public.save_life_insurance_intake(%L,''report_card'',%L,%L,%L,%L::jsonb,false)',household,report,saved->>'id',saved->>'updated_at',a),'INTAKE:unavailable');
 PERFORM pg_temp.expect_rejection(format('SELECT public.save_life_insurance_intake(%L,''contact'',%L,%L,''2000-01-01'',%L::jsonb,false)',household,contact,saved->>'id',a),'INTAKE:conflict');
 -- Life and Student Loan intake types cannot be substituted through the public wrapper.
 PERFORM pg_temp.expect_rejection(format('SELECT public.save_student_loan_intake(%L,''contact'',%L,%L,%L,%L::jsonb,false)',household,contact,saved->>'id',saved->>'updated_at',a),'INTAKE:invalid_structure');
 -- Direct REST-like writes cannot mutate this record or insert another one.
 UPDATE public.assessments SET answers='{}' WHERE id=(saved->>'id')::uuid;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Direct update bypass'; END IF;
 PERFORM pg_temp.expect_rejection(format('INSERT INTO public.assessments(household_id,assessment_type,capture_channel,status,completed_at,answers) VALUES(%L,''life_insurance_intake'',''advisor_onboarding'',''draft'',NULL,%L::jsonb)',household,a),'INTAKE:rpc_required');
 updated := public.save_life_insurance_intake(household,'contact',contact,(saved->>'id')::uuid,(saved->>'updated_at')::timestamptz,complete_a,false);
 IF updated->>'updated_at' = saved->>'updated_at' THEN RAISE EXCEPTION 'Revision did not advance'; END IF;
 PERFORM pg_temp.expect_rejection(format('SELECT public.save_life_insurance_intake(%L,''contact'',%L,%L,%L,%L::jsonb,false)',household,contact,saved->>'id',saved->>'updated_at',a),'INTAKE:conflict');
 completed := public.save_life_insurance_intake(household,'contact',contact,(updated->>'id')::uuid,(updated->>'updated_at')::timestamptz,complete_a,true);
 IF completed->>'status' <> 'completed' OR completed->>'completed_at' IS NULL THEN RAISE EXCEPTION 'Completion failed'; END IF;
 PERFORM pg_temp.expect_rejection(format('SELECT public.save_life_insurance_intake(%L,''contact'',%L,%L,%L,%L::jsonb,false)',household,contact,completed->>'id',completed->>'updated_at',a),'INTAKE:preserved_record');
 PERFORM pg_temp.expect_rejection(format('SELECT public.save_life_insurance_intake(%L,''contact'',%L,NULL,NULL,%L::jsonb,true)',household,contact,complete_a),'INTAKE:save_draft_first');
 new_review := public.save_life_insurance_intake(household,'contact',contact,NULL,NULL,a,false);
 IF new_review->>'id' = completed->>'id' THEN RAISE EXCEPTION 'History replaced'; END IF;
 saved := public.save_life_insurance_intake(household,'report_card',report,NULL,NULL,a,false);
 IF (SELECT to_jsonb(x) FROM public.assessments x WHERE id=report) IS DISTINCT FROM original_report THEN RAISE EXCEPTION 'Report mutated'; END IF;
 SELECT count(*) INTO result_count FROM public.activities WHERE assessment_id=(completed->>'id')::uuid;
 IF result_count <> 2 THEN RAISE EXCEPTION 'Start/completion activity mismatch'; END IF;
 -- Another valid user without household access sees no records and cannot save.
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 PERFORM set_config('crm.rpc_context','assign_household',true);
 UPDATE public.households SET assigned_advisor_id=NULL WHERE id=household;
 PERFORM set_config('crm.rpc_context','',true);
 PERFORM set_config('request.jwt.claim.sub',advisor_user::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',advisor_user,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 IF EXISTS(SELECT 1 FROM public.assessments WHERE household_id=household) THEN RAISE EXCEPTION 'Cross-household read'; END IF;
 PERFORM pg_temp.expect_rejection(cmd,'INTAKE:unavailable');
 RESET ROLE;
 -- Owner cannot bypass completion preservation through direct table access either.
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 DELETE FROM public.assessments WHERE id=(completed->>'id')::uuid;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Completed record deleted'; END IF;
 RESET ROLE;
END;
$$;
ROLLBACK;
SELECT 'PASS: draft, completion, version history, both origins, preserved reports, activity, schema validation, anonymous rejection, household authorization, stale revisions, duplicate drafts, source substitution, direct-write protection' AS result;
