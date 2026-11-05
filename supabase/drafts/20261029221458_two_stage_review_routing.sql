-- Release prerequisite; not applied to production by this change.
-- Support both saved assessment formats and the two new insurance review types.
-- No historical reassignment, new routing trigger, owner transfer, outbound event,
-- function privilege, or existing RLS policy change.
DO $migration$
DECLARE fn record; original text; definition text; updated_count integer:=0;
 old_format text := $anchor$->>'format'='combined-priorities-v1'$anchor$;
 new_format text := $anchor$->>'format' IN ('combined-priorities-v1','combined-priorities-v2')$anchor$;
 old_types text := $types$'family','business','home_buyer','retirement','tsp','health','student_loan','credit','lifestyle','benefits','protection','tax'$types$;
 new_types text := $types$'family','business','home_buyer','retirement','tsp','health','student_loan','credit','lifestyle','benefits','protection','tax','commercial','trucking'$types$;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.intake_review_assignments'::regclass AND conname='intake_review_assignments_review_type_check' AND contype='c') THEN
  RAISE EXCEPTION 'two_stage_review_constraint_missing';
 END IF;
 ALTER TABLE public.intake_review_assignments DROP CONSTRAINT intake_review_assignments_review_type_check;
 ALTER TABLE public.intake_review_assignments ADD CONSTRAINT intake_review_assignments_review_type_check CHECK(review_type IN('family','business','home_buyer','retirement','tsp','health','student_loan','credit','lifestyle','benefits','protection','tax','commercial','trucking'));
 FOR fn IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('route_public_intake_reviews','assign_intake_submission') LOOP
  original:=pg_get_functiondef(fn.oid);
  IF position(old_format in original)=0 AND position(new_format in original)=0 THEN RAISE EXCEPTION 'two_stage_format_anchor_missing: %',fn.proname; END IF;
  definition:=replace(original,old_format,new_format);
  IF fn.proname='route_public_intake_reviews' THEN
   IF position(old_types in original)=0 AND position(new_types in original)=0 THEN RAISE EXCEPTION 'two_stage_types_anchor_missing'; END IF;
   definition:=replace(definition,old_types,new_types);
  END IF;
  IF definition<>original THEN EXECUTE definition; END IF;
  updated_count:=updated_count+1;
 END LOOP;
 IF updated_count<>2 THEN RAISE EXCEPTION 'two_stage_expected_two_functions'; END IF;
END $migration$;
