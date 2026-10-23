CREATE OR REPLACE FUNCTION public.validate_client_intake_contract(p_answers jsonb, p_complete boolean, p_contract jsonb, p_required_rows text[])
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  c jsonb := p_contract;
  s jsonb; f jsonb; r jsonb; rows jsonb; v text; active boolean; parsed_date date;
BEGIN
  IF p_complete IS NULL OR jsonb_typeof(p_answers) IS DISTINCT FROM 'object'
     OR octet_length(p_answers::text) > 750000
     OR p_answers->'version' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(p_answers->'tracks') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_answers->'sections') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INTAKE:invalid_structure';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_answers) k WHERE k NOT IN ('version','tracks','sections'))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_answers->'tracks') t WHERE NOT (c->'tracks' @> jsonb_build_array(t)))
     OR (SELECT count(*) <> count(DISTINCT t) FROM jsonb_array_elements(p_answers->'tracks') t)
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_answers->'sections') k WHERE NOT EXISTS
       (SELECT 1 FROM jsonb_array_elements(c->'sections') x WHERE x->>'id' = k)) THEN
    RAISE EXCEPTION 'INTAKE:invalid_structure';
  END IF;
  IF p_complete AND (jsonb_array_length(p_answers->'tracks') = 0
    OR p_answers#>>'{sections,client,0,confirmed}' IS DISTINCT FROM 'Yes') THEN
    RAISE EXCEPTION 'INTAKE:incomplete';
  END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(c->'sections') LOOP
    rows := p_answers->'sections'->(s->>'id');
    IF jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INTAKE:invalid_records'; END IF;
    IF jsonb_array_length(rows) > 50 OR (NOT coalesce((s->>'repeatable')::boolean,false) AND jsonb_array_length(rows) <> 1) THEN
      RAISE EXCEPTION 'INTAKE:invalid_records';
    END IF;
    active := s->>'track' IS NULL OR p_answers->'tracks' ? (s->>'track');
    IF p_complete AND active AND s->>'id' = ANY(p_required_rows) AND jsonb_array_length(rows) = 0 THEN
      RAISE EXCEPTION 'INTAKE:incomplete';
    END IF;
    FOR r IN SELECT value FROM jsonb_array_elements(rows) LOOP
      IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INTAKE:invalid_fields'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(r) k WHERE NOT EXISTS
        (SELECT 1 FROM jsonb_array_elements(s->'fields') x WHERE x->>'id' = k)) THEN RAISE EXCEPTION 'INTAKE:invalid_fields'; END IF;
      FOR f IN SELECT value FROM jsonb_array_elements(s->'fields') LOOP
        IF NOT (r ? (f->>'id')) AND coalesce((f->>'introduced')::boolean,false) THEN
          IF p_complete AND coalesce((f->>'required')::boolean,false) THEN RAISE EXCEPTION 'INTAKE:incomplete'; END IF;
          CONTINUE;
        END IF;
        v := r->>(f->>'id');
        IF jsonb_typeof(r->(f->>'id')) IS DISTINCT FROM 'string'
          OR length(v) > (CASE WHEN f->>'kind' = 'multiline' THEN 2000 ELSE 300 END) THEN
          RAISE EXCEPTION 'INTAKE:invalid_value';
        END IF;
        IF p_complete AND active AND coalesce((f->>'required')::boolean,false) AND btrim(v) = '' THEN RAISE EXCEPTION 'INTAKE:incomplete'; END IF;
        IF v = '' THEN CONTINUE; END IF;
        IF f->>'kind' IN ('number','money') AND v ~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
          IF (f ? 'min' AND v::numeric < (f->>'min')::numeric)
            OR (f ? 'max' AND v::numeric > (f->>'max')::numeric)
            OR (coalesce((f->>'integer')::boolean,false) AND v::numeric <> trunc(v::numeric)) THEN
            RAISE EXCEPTION 'INTAKE:invalid_number';
          END IF;
        END IF;
        CASE f->>'kind'
          WHEN 'select' THEN
            IF NOT (f->'options' ? v) THEN RAISE EXCEPTION 'INTAKE:invalid_option'; END IF;
          WHEN 'money' THEN
            IF v !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'INTAKE:invalid_amount'; END IF;
            IF v::numeric > 100000000 THEN RAISE EXCEPTION 'INTAKE:invalid_amount'; END IF;
          WHEN 'number' THEN
            IF v !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'INTAKE:invalid_number'; END IF;
            IF v::numeric > 1000000 THEN RAISE EXCEPTION 'INTAKE:invalid_number'; END IF;
          WHEN 'email' THEN
            IF v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'INTAKE:invalid_email'; END IF;
          WHEN 'date' THEN
            IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'INTAKE:invalid_date'; END IF;
            BEGIN
              parsed_date := v::date;
              IF to_char(parsed_date,'YYYY-MM-DD') <> v THEN RAISE EXCEPTION 'INTAKE:invalid_date'; END IF;
            EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INTAKE:invalid_date'; END;
          ELSE NULL;
        END CASE;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_client_intake_contract(jsonb, boolean, jsonb, text[]) FROM PUBLIC, anon, authenticated;



CREATE OR REPLACE FUNCTION public.validate_student_loan_intake(p_answers jsonb, p_complete boolean)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE dob text;
BEGIN
 PERFORM public.validate_client_intake_contract(p_answers,p_complete,public.student_loan_intake_contract(),ARRAY['loans','employment','schools']);
 dob := p_answers#>>'{sections,client,0,dateOfBirth}';
 IF coalesce(dob,'') <> '' AND dob::date > (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'INTAKE:future_birth_date'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_student_loan_intake(jsonb,boolean) FROM PUBLIC, anon, authenticated;
