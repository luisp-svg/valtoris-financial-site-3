BEGIN;
SELECT set_config('crm.rpc_context','quick_add_contact',true);
INSERT INTO households(display_name,lead_source,relationship_pipeline_id,relationship_stage_id)
VALUES('TAC workflow rollback test','manual_contact','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333001')
RETURNING set_config('tac.test_household',id::text,true);
INSERT INTO household_members(household_id,first_name,last_name,is_primary_contact)
VALUES(current_setting('tac.test_household')::uuid,'TAC','Test',true)
RETURNING set_config('tac.test_member',id::text,true);
SELECT set_config('crm.rpc_context','',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(select id from profiles where role='owner' and is_active limit 1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE a jsonb; saved jsonb; first_saved jsonb; hh uuid := current_setting('tac.test_household')::uuid;
BEGIN
a := '{"version":1,"tracks":["pc"],"sections":{"client":[{"firstName":"TAC","lastName":"Test","email":"","phone":"","state":"TX","goal":"Quote test","confirmed":"Not yet"}],"coverage":[{"type":"Auto","effectiveDate":"","currentCarrier":"","renewalDate":"","coverageConcerns":"","quoteReference":"","locations":"","handoff":""}],"review":[{"nextStep":"","owner":"","dueDate":"","missing":"","confirmed":"Not yet"}]}}';
-- Invalid origins must not promote a contact.
BEGIN
PERFORM save_service_intake(hh,'member','00000000-0000-0000-0000-000000000001',NULL,NULL,a,false);
RAISE EXCEPTION 'invalid origin unexpectedly saved';
EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%INTAKE:unavailable%' THEN RAISE; END IF; END;
IF (SELECT status FROM households WHERE id=hh) <> 'lead' THEN RAISE EXCEPTION 'failed save promoted household'; END IF;
SELECT save_service_intake(hh,'member',current_setting('tac.test_member')::uuid,NULL,NULL,a,false) INTO saved;
first_saved := saved;
IF NOT EXISTS (SELECT 1 FROM households h JOIN pipeline_stages s ON s.id=h.relationship_stage_id WHERE h.id=hh AND h.status='prospect' AND s.code='active_prospect') THEN RAISE EXCEPTION 'save did not promote'; END IF;
SELECT save_service_intake(hh,'member',current_setting('tac.test_member')::uuid,(saved->>'id')::uuid,(saved->>'updated_at')::timestamptz,a,false) INTO saved;
IF (SELECT count(*) FROM activities WHERE household_id=hh AND activity_type='stage_changed') <> 1 THEN RAISE EXCEPTION 'duplicate promotion'; END IF;
BEGIN
PERFORM save_service_intake(hh,'member',current_setting('tac.test_member')::uuid,(saved->>'id')::uuid,(first_saved->>'updated_at')::timestamptz,a,false);
RAISE EXCEPTION 'stale draft unexpectedly saved';
EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%INTAKE:conflict%' THEN RAISE; END IF; END;
-- Further saved drafts must not downgrade clients.
PERFORM move_household_stage(hh,'33333333-3333-3333-3333-333333333008');
SELECT save_service_intake(hh,'member',current_setting('tac.test_member')::uuid,(saved->>'id')::uuid,(saved->>'updated_at')::timestamptz,a,false) INTO saved;
IF (SELECT status FROM households WHERE id=hh) <> 'client' THEN RAISE EXCEPTION 'client stage regressed'; END IF;
END $$;
ROLLBACK;