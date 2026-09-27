-- Approved additive service production foundation. No historical backfill.
-- Writing advisors only; service estimates do not use insurance rate cards.
BEGIN;

CREATE TABLE public.service_production_records (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  service_line text NOT NULL CHECK (service_line IN ('pc_personal','pc_commercial','health','student_loans','credit_repair','wills_trusts','tax_strategy')),
  provider_name text NOT NULL CHECK (provider_name = btrim(provider_name) AND length(provider_name) BETWEEN 1 AND 200),
  product_name text NOT NULL CHECK (product_name = btrim(product_name) AND length(product_name) BETWEEN 1 AND 200),
  external_reference text CHECK (length(external_reference) BETWEEN 1 AND 100),
  submission_date date,
  production_status text NOT NULL DEFAULT 'draft' CHECK (production_status IN ('draft','submitted','completed','cancelled')),
  value_cents bigint CHECK (value_cents BETWEEN 0 AND 999999999999),
  value_basis text NOT NULL CHECK (value_basis IN ('annual_premium','contract_value','referral_value','recovery_value')),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  notes text CHECK (length(notes) <= 5000),
  revision integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (production_status NOT IN ('submitted','completed') OR submission_date IS NOT NULL),
  CHECK ((service_line IN ('pc_personal','pc_commercial','health') AND value_basis = 'annual_premium') OR
    (service_line NOT IN ('pc_personal','pc_commercial','health') AND value_basis <> 'annual_premium'))
);
CREATE UNIQUE INDEX service_production_live_opportunity ON public.service_production_records(opportunity_id) WHERE deleted_at IS NULL;
CREATE INDEX service_production_household ON public.service_production_records(household_id);

CREATE TABLE public.service_production_allocations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.service_production_records(id) ON DELETE RESTRICT,
  advisor_id uuid NOT NULL REFERENCES public.advisor_profiles(id) ON DELETE RESTRICT,
  writing_bps integer NOT NULL CHECK (writing_bps BETWEEN 1 AND 10000),
  compensation_model text CHECK (compensation_model IN ('pc_split','flat_referral','percent_contract','tax_recovery','student_loan_service','credit_repair')),
  expected_cents bigint CHECK (expected_cents BETWEEN 0 AND 999999999999),
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','reviewed')),
  review_basis text CHECK (length(review_basis) BETWEEN 1 AND 2000),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  CHECK ((review_status = 'unreviewed' AND compensation_model IS NULL AND expected_cents IS NULL AND review_basis IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
    (review_status = 'reviewed' AND compensation_model IS NOT NULL AND expected_cents IS NOT NULL AND review_basis IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX service_production_current_advisor ON public.service_production_allocations(record_id, advisor_id) WHERE effective_to IS NULL;

CREATE TABLE public.service_production_history (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.service_production_records(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created','updated','allocations_changed','estimate_reviewed','archived')),
  -- NULL means ordinary production history; estimates are visible only to their recipient/owner.
  advisor_id uuid REFERENCES public.advisor_profiles(id) ON DELETE RESTRICT,
  changes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(changes) = 'object' AND octet_length(changes::text) <= 20000),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_production_history_record ON public.service_production_history(record_id, created_at);

CREATE FUNCTION public.sp_can_access(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
  SELECT (public.crm_is_owner() OR public.crm_is_advisor()) AND EXISTS (
    SELECT 1 FROM public.service_production_records r
    JOIN public.opportunities o ON o.id = r.opportunity_id AND o.household_id = r.household_id
    JOIN public.households h ON h.id = r.household_id
    WHERE r.id = p_id AND (r.deleted_at IS NULL OR public.crm_is_owner())
      AND o.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
      AND public.crm_can_access_household(r.household_id) AND public.crm_can_access_opportunity(r.opportunity_id)
  );
$$;
REVOKE ALL ON FUNCTION public.sp_can_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_can_access(uuid) TO authenticated;

ALTER TABLE public.service_production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_production_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_production_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_production_records, public.service_production_allocations, public.service_production_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.service_production_records, public.service_production_allocations, public.service_production_history TO authenticated;
CREATE POLICY service_production_read ON public.service_production_records FOR SELECT TO authenticated USING (public.sp_can_access(id));
CREATE POLICY service_allocation_read ON public.service_production_allocations FOR SELECT TO authenticated USING (
  public.sp_can_access(record_id) AND (public.crm_is_owner() OR advisor_id = public.crm_advisor_id()));
CREATE POLICY service_history_read ON public.service_production_history FOR SELECT TO authenticated USING (
  public.sp_can_access(record_id) AND (advisor_id IS NULL OR public.crm_is_owner() OR advisor_id = public.crm_advisor_id()));

-- Shared database integrity guard: both record types serialize on their opportunity.
-- Existing insurance RPCs are unchanged; the guard closes alternate conversion paths.
CREATE FUNCTION public.sp_link_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE o public.opportunities; v text;
BEGIN
  IF NEW.opportunity_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO o FROM public.opportunities WHERE id = NEW.opportunity_id FOR UPDATE;
  IF TG_TABLE_NAME = 'policy_applications' THEN
    IF NEW.deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.service_production_records WHERE opportunity_id = NEW.opportunity_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'CRM_SP:opportunity_already_used';
    END IF;
    RETURN NEW;
  END IF;
  IF o.id IS NULL OR o.deleted_at IS NOT NULL OR o.household_id <> NEW.household_id THEN RAISE EXCEPTION 'CRM_SP:invalid_relationship'; END IF;
  SELECT code INTO v FROM public.service_verticals WHERE id = o.service_vertical_id AND is_active;
  IF v IS DISTINCT FROM (CASE WHEN NEW.service_line IN ('pc_personal','pc_commercial') THEN 'pc' ELSE NEW.service_line END) THEN
    RAISE EXCEPTION 'CRM_SP:invalid_service_line';
  END IF;
  IF NEW.deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.policy_applications WHERE opportunity_id = NEW.opportunity_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'CRM_SP:opportunity_already_used';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER service_production_link BEFORE INSERT OR UPDATE OF opportunity_id, household_id, service_line, deleted_at ON public.service_production_records FOR EACH ROW EXECUTE FUNCTION public.sp_link_guard();
CREATE TRIGGER policy_service_link BEFORE INSERT OR UPDATE OF opportunity_id, deleted_at ON public.policy_applications FOR EACH ROW EXECUTE FUNCTION public.sp_link_guard();

CREATE FUNCTION public.sp_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CRM_SP:history_immutable'; END;
$$;
CREATE TRIGGER service_history_immutable BEFORE UPDATE OR DELETE ON public.service_production_history FOR EACH ROW EXECUTE FUNCTION public.sp_history_immutable();

-- Private helper. Reject unexpected fields; never accept caller-supplied review data.
CREATE FUNCTION public.sp_replace_allocations(p_id uuid, p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE j jsonb; n integer; total integer;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'CRM_SP:invalid_splits'; END IF;
  FOR j IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    PERFORM public.pp_assert_object_keys(j, ARRAY['advisor_id','writing_bps']);
    IF (j->>'writing_bps') !~ '^[0-9]{1,5}$' OR (j->>'writing_bps')::integer NOT BETWEEN 1 AND 10000
      OR NOT EXISTS (SELECT 1 FROM public.advisor_profiles a JOIN public.profiles p ON p.id = a.user_id
        WHERE a.id = (j->>'advisor_id')::uuid AND a.is_active AND a.deleted_at IS NULL AND p.is_active AND p.deleted_at IS NULL AND p.role IN ('owner','advisor')) THEN
      RAISE EXCEPTION 'CRM_SP:invalid_splits';
    END IF;
  END LOOP;
  SELECT count(DISTINCT value->>'advisor_id'), sum((value->>'writing_bps')::integer) INTO n,total FROM jsonb_array_elements(p_rows);
  IF n <> jsonb_array_length(p_rows) OR total IS DISTINCT FROM 10000 THEN RAISE EXCEPTION 'CRM_SP:invalid_splits'; END IF;
  UPDATE public.service_production_allocations SET effective_to = now() WHERE record_id = p_id AND effective_to IS NULL;
  INSERT INTO public.service_production_allocations(record_id, advisor_id, writing_bps)
    SELECT p_id, (value->>'advisor_id')::uuid, (value->>'writing_bps')::integer FROM jsonb_array_elements(p_rows);
END;
$$;

CREATE FUNCTION public.create_service_production(p_opportunity_id uuid, p_payload jsonb, p_allocations jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE o public.opportunities; result uuid;
BEGIN
  IF NOT (public.crm_is_owner() OR public.crm_is_advisor()) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  PERFORM public.pp_assert_payload_size(p_payload);
  PERFORM public.pp_assert_object_keys(p_payload, ARRAY['service_line','provider_name','product_name','external_reference','submission_date','production_status','value_cents','value_basis','notes']);
  SELECT * INTO o FROM public.opportunities WHERE id = p_opportunity_id AND deleted_at IS NULL FOR UPDATE;
  IF o.id IS NULL OR NOT public.crm_can_access_household(o.household_id) OR NOT public.crm_can_access_opportunity(o.id)
    OR NOT EXISTS (SELECT 1 FROM public.households WHERE id = o.household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  SELECT id INTO result FROM public.service_production_records WHERE opportunity_id = o.id AND deleted_at IS NULL;
  IF result IS NOT NULL THEN RETURN result; END IF;
  IF o.status NOT IN ('open','on_hold','won') THEN RAISE EXCEPTION 'CRM_SP:opportunity_closed'; END IF;
  INSERT INTO public.service_production_records(household_id,opportunity_id,service_line,provider_name,product_name,external_reference,submission_date,production_status,value_cents,value_basis,notes,created_by)
    VALUES(o.household_id,o.id,p_payload->>'service_line',btrim(p_payload->>'provider_name'),btrim(p_payload->>'product_name'),nullif(btrim(p_payload->>'external_reference'),''),(p_payload->>'submission_date')::date,coalesce(p_payload->>'production_status','draft'),(p_payload->>'value_cents')::bigint,p_payload->>'value_basis',nullif(btrim(p_payload->>'notes'),''),auth.uid()) RETURNING id INTO result;
  PERFORM public.sp_replace_allocations(result,p_allocations);
  INSERT INTO public.service_production_history(record_id,actor_id,event_type,changes,reason) VALUES(result,auth.uid(),'created',jsonb_build_object('record',p_payload),'Service production created');
  RETURN result;
END;
$$;

-- Revision checks prevent a stale screen from overwriting another person's changes.
CREATE FUNCTION public.update_service_production(p_id uuid, p_revision integer, p_payload jsonb, p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE r public.service_production_records; n public.service_production_records;
BEGIN
  IF NOT public.sp_can_access(p_id) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  PERFORM public.pp_assert_payload_size(p_payload);
  PERFORM public.pp_assert_object_keys(p_payload, ARRAY['provider_name','product_name','external_reference','submission_date','production_status','value_cents','value_basis','notes']);
  SELECT * INTO r FROM public.service_production_records WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  IF r.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CRM_SP:stale_record'; END IF;
  UPDATE public.service_production_records SET provider_name=btrim(p_payload->>'provider_name'),product_name=btrim(p_payload->>'product_name'),external_reference=nullif(btrim(p_payload->>'external_reference'),''),submission_date=(p_payload->>'submission_date')::date,production_status=p_payload->>'production_status',value_cents=(p_payload->>'value_cents')::bigint,value_basis=p_payload->>'value_basis',notes=nullif(btrim(p_payload->>'notes'),''),revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO n;
  -- Product, provider, value or basis changes invalidate estimates; a new review is required.
  IF (r.provider_name,r.product_name,r.value_cents,r.value_basis,r.submission_date) IS DISTINCT FROM (n.provider_name,n.product_name,n.value_cents,n.value_basis,n.submission_date) THEN
    UPDATE public.service_production_allocations SET compensation_model=NULL,expected_cents=NULL,review_status='unreviewed',review_basis=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE record_id=p_id AND effective_to IS NULL;
  END IF;
  INSERT INTO public.service_production_history(record_id,actor_id,event_type,changes,reason) VALUES(p_id,auth.uid(),'updated',jsonb_build_object('before',to_jsonb(r),'after',to_jsonb(n)),p_reason);
  RETURN n.revision;
END;
$$;

CREATE FUNCTION public.set_service_production_allocations(p_id uuid, p_revision integer, p_allocations jsonb, p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE r public.service_production_records;
BEGIN
  IF NOT public.crm_is_owner() OR NOT public.sp_can_access(p_id) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  SELECT * INTO r FROM public.service_production_records WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  IF r.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CRM_SP:stale_record'; END IF;
  PERFORM public.sp_replace_allocations(p_id,p_allocations);
  UPDATE public.service_production_records SET revision=revision+1,updated_at=now() WHERE id=p_id;
  INSERT INTO public.service_production_history(record_id,actor_id,event_type,reason) VALUES(p_id,auth.uid(),'allocations_changed',p_reason);
  RETURN r.revision+1;
END;
$$;

CREATE FUNCTION public.review_service_production_estimate(p_id uuid, p_revision integer, p_allocation_id uuid, p_model text, p_expected_cents bigint, p_basis text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE r public.service_production_records; a public.service_production_allocations;
BEGIN
  IF NOT public.crm_is_owner() OR NOT public.sp_can_access(p_id) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  SELECT * INTO r FROM public.service_production_records WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  IF r.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CRM_SP:stale_record'; END IF;
  SELECT * INTO a FROM public.service_production_allocations WHERE id=p_allocation_id AND record_id=p_id AND effective_to IS NULL;
  IF a.id IS NULL THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  IF p_model = 'pc_split' AND r.service_line NOT IN ('pc_personal','pc_commercial') OR
    p_model = 'tax_recovery' AND r.service_line <> 'tax_strategy' OR
    p_model = 'student_loan_service' AND r.service_line <> 'student_loans' OR
    p_model = 'credit_repair' AND r.service_line <> 'credit_repair' THEN RAISE EXCEPTION 'CRM_SP:invalid_model'; END IF;
  UPDATE public.service_production_allocations SET compensation_model=p_model,expected_cents=p_expected_cents,review_status='reviewed',review_basis=btrim(p_basis),reviewed_by=auth.uid(),reviewed_at=now() WHERE id=a.id;
  UPDATE public.service_production_records SET revision=revision+1,updated_at=now() WHERE id=p_id;
  INSERT INTO public.service_production_history(record_id,actor_id,event_type,advisor_id,changes,reason) VALUES(p_id,auth.uid(),'estimate_reviewed',a.advisor_id,jsonb_build_object('before',to_jsonb(a),'model',p_model,'expected_cents',p_expected_cents,'basis',btrim(p_basis)),'Owner reviewed writing-advisor estimate');
  RETURN r.revision+1;
END;
$$;

CREATE FUNCTION public.archive_service_production(p_id uuid, p_revision integer, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE r public.service_production_records;
BEGIN
  IF NOT public.crm_is_owner() OR NOT public.sp_can_access(p_id) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  -- Same lock order as conversion: opportunity then record.
  PERFORM 1 FROM public.opportunities WHERE id=(SELECT opportunity_id FROM public.service_production_records WHERE id=p_id) FOR UPDATE;
  SELECT * INTO r FROM public.service_production_records WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
  IF r.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CRM_SP:stale_record'; END IF;
  UPDATE public.service_production_records SET deleted_at=now(),updated_at=now(),revision=revision+1 WHERE id=p_id;
  INSERT INTO public.service_production_history(record_id,actor_id,event_type,reason) VALUES(p_id,auth.uid(),'archived',p_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.sp_link_guard(),public.sp_history_immutable(),public.sp_replace_allocations(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_service_production(uuid,jsonb,jsonb),public.update_service_production(uuid,integer,jsonb,text),public.set_service_production_allocations(uuid,integer,jsonb,text),public.review_service_production_estimate(uuid,integer,uuid,text,bigint,text),public.archive_service_production(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_service_production(uuid,jsonb,jsonb),public.update_service_production(uuid,integer,jsonb,text),public.set_service_production_allocations(uuid,integer,jsonb,text),public.review_service_production_estimate(uuid,integer,uuid,text,bigint,text),public.archive_service_production(uuid,integer,text) TO authenticated;

-- Seed only missing catalogs; resolve by code instead of remapping existing IDs.
DO $$
DECLARE v uuid; p uuid; v_code text; label text; stage_code text; ordinal integer;
BEGIN
  FOR v_code,label IN SELECT * FROM (VALUES ('health','Health'),('tax_strategy','Tax Strategy')) x(code,label) LOOP
    INSERT INTO public.service_verticals(code,name,sort_order) VALUES(v_code,label,CASE v_code WHEN 'health' THEN 7 ELSE 8 END) ON CONFLICT ON CONSTRAINT service_verticals_code_unique DO NOTHING;
    SELECT id INTO v FROM public.service_verticals sv WHERE sv.code=v_code;
    SELECT id INTO p FROM public.pipelines WHERE service_vertical_id=v AND is_default AND is_active;
    IF p IS NULL THEN
      INSERT INTO public.pipelines(name,pipeline_type,service_vertical_id,is_default,is_active) VALUES(label || ' Pipeline','service',v,true,true) RETURNING id INTO p;
      ordinal:=0;
      FOREACH stage_code IN ARRAY ARRAY['identified','consultation','presented','sold','closed_lost'] LOOP
        ordinal:=ordinal+1;
        INSERT INTO public.pipeline_stages(pipeline_id,name,code,sort_order,is_won,is_lost,is_terminal) VALUES(p,initcap(replace(stage_code,'_',' ')),stage_code,ordinal,stage_code='sold',stage_code='closed_lost',stage_code='closed_lost');
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
COMMIT;
