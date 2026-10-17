-- Extend the deployed functions in place, preserving later fixes, ACLs, consent,
-- duplicate resolution, attribution, idempotency locks, and the shared delivery queue.
-- No queue backfill and no AgentCRM tag definitions or workflow changes.
DO $migration$
DECLARE
 fn record;
 definition text;
 original text;
 old_list text := $types$'family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer'$types$;
 new_list text := $types$'family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer', 'health', 'tsp', 'benefits', 'tax'$types$;
 marker text;
 replacement text;
 new_type text;
 label text;
 lead_source text;
 updated_count integer := 0;
BEGIN
 FOR fn IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('ingest_public_report_card','create_public_family_follow_up_task','resolve_public_family_duplicate_review','enqueue_insurance_quote_delivery')
 LOOP
  original := pg_get_functiondef(fn.oid);
  IF position(new_list in original)>0 OR position(replace(new_list,' ','') in original)>0 THEN
   updated_count := updated_count+1; CONTINUE;
  END IF;
  definition := replace(original,old_list,new_list);
  definition := replace(definition,replace(old_list,' ',''),replace(new_list,' ',''));
  IF definition = original THEN RAISE EXCEPTION 'guided_report_migration_anchor_missing: %',fn.proname; END IF;
  FOR marker IN SELECT (regexp_matches(original, $rx$WHEN 'home_buyer' THEN '[^']*'$rx$, 'g'))[1]
  LOOP
   replacement := marker;
   FOREACH new_type IN ARRAY ARRAY['health','tsp','benefits','tax'] LOOP
    label := CASE new_type WHEN 'health' THEN 'Health Insurance Report Card' WHEN 'tsp' THEN 'TSP Report Card' WHEN 'benefits' THEN 'Employee Benefits Report Card' WHEN 'tax' THEN 'Tax Review Report Card' END;
    lead_source := CASE new_type WHEN 'health' THEN 'health_report_card' WHEN 'tsp' THEN 'tsp_report_card' WHEN 'benefits' THEN 'employee_benefits_report_card' WHEN 'tax' THEN 'tax_planning_report_card' END;
    replacement := replacement || E'\n    ' || replace(replace(replace(marker, $a$WHEN 'home_buyer'$a$, 'WHEN ' || quote_literal(new_type)), 'Home Buyer Report Card',label), 'home_buyer_report_card',lead_source);
   END LOOP;
   definition := replace(definition,marker,replacement);
  END LOOP;
  -- Duplicate review also has a separate lead-label allowlist.
  definition := regexp_replace(definition,
    $rx$'Home Buyer Report Card'(\s*\))$rx$,
    $labels$'Home Buyer Report Card', 'Health Insurance Report Card', 'TSP Report Card', 'Employee Benefits Report Card', 'Tax Review Report Card'\1$labels$, 'g');
  EXECUTE definition;
  updated_count := updated_count + 1;
 END LOOP;
 IF updated_count <> 4 THEN RAISE EXCEPTION 'guided_report_migration_expected_four_functions'; END IF;
END $migration$;
