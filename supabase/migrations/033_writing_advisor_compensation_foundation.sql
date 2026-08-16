-- 033_writing_advisor_compensation_foundation.sql
-- Writing-advisor compensation RATE-CARD foundation.
--
-- Adds:
--   advisor_profiles.contract_level          (current FA/SFA/SM/ED)
--   policy_agent_allocations.writing_contract_level  (immutable snapshot)
--   public.product_compensation_schedules    (product rate cards)
--   owner RPCs: set_advisor_contract_level,
--               create/update/deactivate_product_compensation_schedule
--
-- This is writing-advisor compensation only. It does NOT model upline,
-- generational, hierarchy, spread, or override compensation.
--
-- It does NOT store expected / pending / eligible / released / paid /
-- adjusted dollar amounts. Those belong to a later ledger.
--
-- Rate-card effective lookup date (later calculation engine, not this
-- migration):
--   1. policy_applications.submission_date
--   2. fallback policy_applications.issue_date
--   3. otherwise review_required
-- Do NOT use created_at for money calculations.
--
-- Issue age is a SEPARATE input from the rate-card effective date:
--   insured (life) or annuitant (FIA) DOB
--   + carrier-appropriate issue-age convention/date
-- This migration does NOT hard-code nearest-age vs attained-age.
-- If an age-specific card requires issue age and it cannot be resolved
-- safely, later calculation must return review_required.
--
-- A missing rate card is unavailable/unresolved. All-zero rates are not
-- automatically valid $0 compensation.
--
-- Does NOT: import source rows, restore advisor ranks, calculate dollars,
-- or create a commission ledger. Out-of-scope carrier books are excluded.

-- =============================================================================
-- SECTION A — Current advisor contract level
-- =============================================================================

ALTER TABLE public.advisor_profiles
  ADD COLUMN IF NOT EXISTS contract_level text;

ALTER TABLE public.advisor_profiles
  DROP CONSTRAINT IF EXISTS advisor_profiles_contract_level_check;

ALTER TABLE public.advisor_profiles
  ADD CONSTRAINT advisor_profiles_contract_level_check
  CHECK (
    contract_level IS NULL
    OR contract_level IN ('FA', 'SFA', 'SM', 'ED')
  );

COMMENT ON COLUMN public.advisor_profiles.contract_level IS
  'Current approved writing-advisor contract level: FA, SFA, SM, or ED. Owner-managed. NULL means unset; later expected-compensation calculation must flag review. Historical policy ranks live on policy_agent_allocations.writing_contract_level, not here.';

CREATE OR REPLACE FUNCTION public.enforce_advisor_profile_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF public.crm_is_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.user_id = auth.uid() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'advisor_profiles.user_id is immutable for advisors';
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'advisor_profiles.slug cannot be changed by advisors';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'advisor_profiles.is_active cannot be changed by advisors';
    END IF;
    IF NEW.accepts_new_leads IS DISTINCT FROM OLD.accepts_new_leads THEN
      RAISE EXCEPTION 'advisor_profiles.accepts_new_leads cannot be changed by advisors';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'advisor_profiles.deleted_at cannot be changed by advisors';
    END IF;
    IF NEW.contract_level IS DISTINCT FROM OLD.contract_level THEN
      RAISE EXCEPTION 'advisor_profiles.contract_level cannot be changed by advisors';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_advisor_contract_level(
  p_advisor_id uuid,
  p_contract_level text
)
RETURNS public.advisor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_level text := NULLIF(btrim(COALESCE(p_contract_level, '')), '');
  v_row public.advisor_profiles;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_advisor_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  IF v_level IS NOT NULL AND v_level NOT IN ('FA', 'SFA', 'SM', 'ED') THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_row
  FROM public.advisor_profiles
  WHERE id = p_advisor_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  UPDATE public.advisor_profiles
  SET contract_level = v_level
  WHERE id = p_advisor_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.set_advisor_contract_level(uuid, text) IS
  'Owner-only. Sets or clears the advisor''s CURRENT writing contract level (FA/SFA/SM/ED). Does not rewrite historical policy_agent_allocations.writing_contract_level rows.';

REVOKE ALL ON FUNCTION public.set_advisor_contract_level(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_advisor_contract_level(uuid, text) TO authenticated;

-- =============================================================================
-- SECTION B — Immutable writing-rank snapshot on allocations
-- =============================================================================

ALTER TABLE public.policy_agent_allocations
  ADD COLUMN IF NOT EXISTS writing_contract_level text;

ALTER TABLE public.policy_agent_allocations
  DROP CONSTRAINT IF EXISTS policy_agent_allocations_writing_contract_level_check;

ALTER TABLE public.policy_agent_allocations
  ADD CONSTRAINT policy_agent_allocations_writing_contract_level_check
  CHECK (
    writing_contract_level IS NULL
    OR writing_contract_level IN ('FA', 'SFA', 'SM', 'ED')
  );

ALTER TABLE public.policy_agent_allocations
  DROP CONSTRAINT IF EXISTS policy_agent_allocations_writing_contract_level_role_check;

ALTER TABLE public.policy_agent_allocations
  ADD CONSTRAINT policy_agent_allocations_writing_contract_level_role_check
  CHECK (
    (
      allocation_role = 'writing'
      AND recipient_type = 'advisor'
    )
    OR writing_contract_level IS NULL
  );

COMMENT ON COLUMN public.policy_agent_allocations.writing_contract_level IS
  'Immutable writing-advisor rank snapshot (FA/SFA/SM/ED) captured when the writing advisor allocation was created. House and servicing rows must be NULL. Do not reuse contract_level_snapshot. A later promotion of advisor_profiles.contract_level must not rewrite this value.';

CREATE OR REPLACE FUNCTION public.pp_apply_allocations(
  p_application_id uuid,
  p_allocations jsonb,
  p_reason text,
  p_actor_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_el jsonb;
  v_now timestamptz := now();
  v_count integer := 0;
  v_recipient public.policy_allocation_recipient_type;
  v_role public.policy_allocation_role;
  v_advisor uuid;
  v_writing_level text;
BEGIN
  UPDATE public.policy_agent_allocations
  SET effective_to = v_now,
      change_reason = COALESCE(p_reason, change_reason)
  WHERE application_id = p_application_id
    AND effective_to IS NULL;

  FOR v_el IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    v_recipient := lower(public.pp_json_text(v_el, 'recipient_type'))::public.policy_allocation_recipient_type;
    v_role := lower(public.pp_json_text(v_el, 'allocation_role'))::public.policy_allocation_role;
    v_advisor := public.pp_json_uuid(v_el, 'advisor_id', 'invalid_allocations');
    v_writing_level := NULL;

    IF v_advisor IS NOT NULL THEN
      PERFORM public.pp_assert_advisor_usable(v_advisor);
    END IF;

    -- Snapshot current rank for writing advisors only. House and servicing
    -- stay NULL. Payload writing_contract_level is ignored / not accepted.
    IF v_recipient = 'advisor' AND v_role = 'writing' AND v_advisor IS NOT NULL THEN
      SELECT ap.contract_level
      INTO v_writing_level
      FROM public.advisor_profiles ap
      WHERE ap.id = v_advisor
        AND ap.deleted_at IS NULL;
    END IF;

    INSERT INTO public.policy_agent_allocations (
      application_id, recipient_type, advisor_id, allocation_role,
      commission_bps, production_credit_bps, contract_level_snapshot,
      writing_contract_level, points_share_scaled, effective_from,
      change_reason, created_by_user_id
    ) VALUES (
      p_application_id,
      v_recipient,
      v_advisor,
      v_role,
      public.pp_json_int(v_el, 'commission_bps', 'invalid_allocations'),
      public.pp_json_int(v_el, 'production_credit_bps', 'invalid_allocations'),
      public.pp_json_text(v_el, 'contract_level_snapshot'),
      v_writing_level,
      public.pp_json_int(v_el, 'points_share_scaled', 'invalid_allocations'),
      v_now,
      p_reason,
      p_actor_user_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_pp_allocation_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_close_contexts text[] := ARRAY[
    'set_policy_application_allocations',
    'transition_policy_application_stage'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.pp_raise('delete_not_allowed');
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_ctx IS DISTINCT FROM 'create_policy_application'
       AND v_ctx IS DISTINCT FROM 'set_policy_application_allocations' THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (v_ctx = ANY (v_close_contexts)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.application_id IS DISTINCT FROM OLD.application_id
     OR NEW.recipient_type IS DISTINCT FROM OLD.recipient_type
     OR NEW.advisor_id IS DISTINCT FROM OLD.advisor_id
     OR NEW.allocation_role IS DISTINCT FROM OLD.allocation_role
     OR NEW.commission_bps IS DISTINCT FROM OLD.commission_bps
     OR NEW.production_credit_bps IS DISTINCT FROM OLD.production_credit_bps
     OR NEW.contract_level_snapshot IS DISTINCT FROM OLD.contract_level_snapshot
     OR NEW.writing_contract_level IS DISTINCT FROM OLD.writing_contract_level
     OR NEW.points_share_scaled IS DISTINCT FROM OLD.points_share_scaled
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- SECTION C — Product compensation rate cards
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_compensation_schedules (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.insurance_products (id) ON DELETE RESTRICT,
  age_min smallint,
  age_max smallint,
  fa_rate numeric(8, 6) NOT NULL,
  sfa_rate numeric(8, 6) NOT NULL,
  sm_rate numeric(8, 6) NOT NULL,
  ed_rate numeric(8, 6) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  source_file text,
  source_sheet text,
  source_row integer,
  source_age_band text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT product_comp_schedules_age_min_check
    CHECK (age_min IS NULL OR age_min >= 0),
  CONSTRAINT product_comp_schedules_age_max_check
    CHECK (age_max IS NULL OR age_max >= 0),
  CONSTRAINT product_comp_schedules_age_order_check
    CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
  CONSTRAINT product_comp_schedules_fa_rate_check
    CHECK (fa_rate >= 0 AND fa_rate <= 2),
  CONSTRAINT product_comp_schedules_sfa_rate_check
    CHECK (sfa_rate >= 0 AND sfa_rate <= 2),
  CONSTRAINT product_comp_schedules_sm_rate_check
    CHECK (sm_rate >= 0 AND sm_rate <= 2),
  CONSTRAINT product_comp_schedules_ed_rate_check
    CHECK (ed_rate >= 0 AND ed_rate <= 2),
  CONSTRAINT product_comp_schedules_effective_dates_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT product_comp_schedules_source_file_check
    CHECK (
      source_file IS NULL
      OR (source_file = btrim(source_file)
          AND char_length(source_file) BETWEEN 1 AND 500)
    ),
  CONSTRAINT product_comp_schedules_source_sheet_check
    CHECK (
      source_sheet IS NULL
      OR (source_sheet = btrim(source_sheet)
          AND char_length(source_sheet) BETWEEN 1 AND 200)
    ),
  CONSTRAINT product_comp_schedules_source_row_check
    CHECK (source_row IS NULL OR source_row > 0),
  CONSTRAINT product_comp_schedules_source_age_band_check
    CHECK (
      source_age_band IS NULL
      OR (source_age_band = btrim(source_age_band)
          AND char_length(source_age_band) BETWEEN 1 AND 100)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_comp_schedules_live_unique_idx
  ON public.product_compensation_schedules (
    product_id,
    COALESCE(age_min, -1),
    COALESCE(age_max, 32767),
    effective_from
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS product_comp_schedules_product_idx
  ON public.product_compensation_schedules (product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS product_comp_schedules_active_idx
  ON public.product_compensation_schedules (product_id, effective_from)
  WHERE deleted_at IS NULL AND is_active = true;

COMMENT ON TABLE public.product_compensation_schedules IS
  'Writing-advisor product rate cards only. Rates are decimal fractions (0.544000 = 54.4%). No expected, pending, paid, or payment-ledger amounts. No upline or generational rates.

Rate-card effective lookup date (later engine): submission_date, else issue_date, else review_required. Never created_at.

Issue age is separate: insured/annuitant DOB + carrier-appropriate convention. Not hard-coded here. Unresolvable age-specific matches must be review_required.';

COMMENT ON COLUMN public.product_compensation_schedules.age_min IS
  'Inclusive lower issue-age bound. NULL = unbounded. Selection uses issue age, not the rate-card effective date.';
COMMENT ON COLUMN public.product_compensation_schedules.age_max IS
  'Inclusive upper issue-age bound. NULL = unbounded.';
COMMENT ON COLUMN public.product_compensation_schedules.fa_rate IS
  'Writing-advisor FA rate as a decimal fraction. NUMERIC, never float.';
COMMENT ON COLUMN public.product_compensation_schedules.source_age_band IS
  'Original source label for audit. Not used for schedule selection.';

DROP TRIGGER IF EXISTS product_comp_schedules_set_updated_at
  ON public.product_compensation_schedules;
CREATE TRIGGER product_comp_schedules_set_updated_at
  BEFORE UPDATE ON public.product_compensation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_product_comp_schedule_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS product_comp_schedules_delete_guard
  ON public.product_compensation_schedules;
CREATE TRIGGER product_comp_schedules_delete_guard
  BEFORE DELETE ON public.product_compensation_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_comp_schedule_delete_guard();

REVOKE ALL ON FUNCTION public.enforce_product_comp_schedule_delete_guard()
  FROM PUBLIC, anon, authenticated;

-- Inclusive age/date overlap helpers. NULL age bound = unbounded.
-- NULL effective_to = open-ended. Adjacent closed ranges do not overlap
-- (2025-12-31 then 2026-01-01 is allowed).
CREATE OR REPLACE FUNCTION public.pp_comp_age_ranges_overlap(
  p_a_min smallint,
  p_a_max smallint,
  p_b_min smallint,
  p_b_max smallint
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT NOT (
    (p_a_max IS NOT NULL AND p_b_min IS NOT NULL AND p_a_max < p_b_min)
    OR
    (p_b_max IS NOT NULL AND p_a_min IS NOT NULL AND p_b_max < p_a_min)
  );
$$;

CREATE OR REPLACE FUNCTION public.pp_comp_date_ranges_overlap(
  p_a_from date,
  p_a_to date,
  p_b_from date,
  p_b_to date
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT NOT (
    (p_a_to IS NOT NULL AND p_a_to < p_b_from)
    OR
    (p_b_to IS NOT NULL AND p_b_to < p_a_from)
  );
$$;

REVOKE ALL ON FUNCTION public.pp_comp_age_ranges_overlap(smallint, smallint, smallint, smallint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_comp_date_ranges_overlap(date, date, date, date)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_comp_schedule_overlaps_live(
  p_product_id uuid,
  p_age_min smallint,
  p_age_max smallint,
  p_effective_from date,
  p_effective_to date,
  p_exclude_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_compensation_schedules s
    WHERE s.deleted_at IS NULL
      AND s.is_active = true
      AND s.product_id = p_product_id
      AND (p_exclude_id IS NULL OR s.id <> p_exclude_id)
      AND public.pp_comp_age_ranges_overlap(s.age_min, s.age_max, p_age_min, p_age_max)
      AND public.pp_comp_date_ranges_overlap(
        s.effective_from, s.effective_to, p_effective_from, p_effective_to
      )
  );
$$;

REVOKE ALL ON FUNCTION public.pp_comp_schedule_overlaps_live(
  uuid, smallint, smallint, date, date, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_product_compensation_schedule(
  p_product_id uuid,
  p_age_min smallint,
  p_age_max smallint,
  p_fa_rate numeric,
  p_sfa_rate numeric,
  p_sm_rate numeric,
  p_ed_rate numeric,
  p_effective_from date,
  p_effective_to date DEFAULT NULL,
  p_source_file text DEFAULT NULL,
  p_source_sheet text DEFAULT NULL,
  p_source_row integer DEFAULT NULL,
  p_source_age_band text DEFAULT NULL
)
RETURNS public.product_compensation_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_product public.insurance_products;
  v_source_file text := NULLIF(btrim(COALESCE(p_source_file, '')), '');
  v_source_sheet text := NULLIF(btrim(COALESCE(p_source_sheet, '')), '');
  v_source_age_band text := NULLIF(btrim(COALESCE(p_source_age_band, '')), '');
  v_row public.product_compensation_schedules;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_product_id IS NULL
     OR p_fa_rate IS NULL OR p_sfa_rate IS NULL
     OR p_sm_rate IS NULL OR p_ed_rate IS NULL
     OR p_effective_from IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  IF p_age_min IS NOT NULL AND p_age_min < 0 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF p_age_max IS NOT NULL AND p_age_max < 0 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF p_age_min IS NOT NULL AND p_age_max IS NOT NULL AND p_age_min > p_age_max THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF p_fa_rate < 0 OR p_fa_rate > 2
     OR p_sfa_rate < 0 OR p_sfa_rate > 2
     OR p_sm_rate < 0 OR p_sm_rate > 2
     OR p_ed_rate < 0 OR p_ed_rate > 2 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF p_effective_to IS NOT NULL AND p_effective_to < p_effective_from THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF (v_source_file IS NOT NULL AND char_length(v_source_file) > 500)
     OR (v_source_sheet IS NOT NULL AND char_length(v_source_sheet) > 200)
     OR (v_source_age_band IS NOT NULL AND char_length(v_source_age_band) > 100)
     OR (p_source_row IS NOT NULL AND p_source_row <= 0) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_product
  FROM public.insurance_products
  WHERE id = p_product_id;
  IF NOT FOUND OR v_product.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_compensation_schedules s
    WHERE s.deleted_at IS NULL
      AND s.product_id = p_product_id
      AND COALESCE(s.age_min, -1) = COALESCE(p_age_min, -1)
      AND COALESCE(s.age_max, 32767) = COALESCE(p_age_max, 32767)
      AND s.effective_from = p_effective_from
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF public.pp_comp_schedule_overlaps_live(
    p_product_id, p_age_min, p_age_max, p_effective_from, p_effective_to, NULL
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  INSERT INTO public.product_compensation_schedules (
    product_id, age_min, age_max,
    fa_rate, sfa_rate, sm_rate, ed_rate,
    effective_from, effective_to,
    source_file, source_sheet, source_row, source_age_band
  ) VALUES (
    p_product_id, p_age_min, p_age_max,
    p_fa_rate, p_sfa_rate, p_sm_rate, p_ed_rate,
    p_effective_from, p_effective_to,
    v_source_file, v_source_sheet, p_source_row, v_source_age_band
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.create_product_compensation_schedule(
  uuid, smallint, smallint, numeric, numeric, numeric, numeric, date, date, text, text, integer, text
) IS
  'Owner-only rate-card create. Rejects duplicate live (product, age bounds, effective_from) and overlapping active age+date ranges. Rates are insert-only; change a rate by closing this card and creating a new one.';

CREATE OR REPLACE FUNCTION public.update_product_compensation_schedule(
  p_id uuid,
  p_effective_to date DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_source_file text DEFAULT NULL,
  p_source_sheet text DEFAULT NULL,
  p_source_row integer DEFAULT NULL,
  p_source_age_band text DEFAULT NULL
)
RETURNS public.product_compensation_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_existing public.product_compensation_schedules;
  v_source_file text;
  v_source_sheet text;
  v_source_age_band text;
  v_effective_to date;
  v_is_active boolean;
  v_row public.product_compensation_schedules;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing
  FROM public.product_compensation_schedules
  WHERE id = p_id
  FOR UPDATE;
  IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF p_effective_to IS NULL
     AND p_is_active IS NULL
     AND p_source_file IS NULL
     AND p_source_sheet IS NULL
     AND p_source_row IS NULL
     AND p_source_age_band IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  v_effective_to := COALESCE(p_effective_to, v_existing.effective_to);
  IF p_effective_to IS NOT NULL AND p_effective_to < v_existing.effective_from THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_is_active := COALESCE(p_is_active, v_existing.is_active);

  v_source_file := CASE
    WHEN p_source_file IS NULL THEN v_existing.source_file
    ELSE NULLIF(btrim(p_source_file), '')
  END;
  v_source_sheet := CASE
    WHEN p_source_sheet IS NULL THEN v_existing.source_sheet
    ELSE NULLIF(btrim(p_source_sheet), '')
  END;
  v_source_age_band := CASE
    WHEN p_source_age_band IS NULL THEN v_existing.source_age_band
    ELSE NULLIF(btrim(p_source_age_band), '')
  END;

  IF (v_source_file IS NOT NULL AND char_length(v_source_file) > 500)
     OR (v_source_sheet IS NOT NULL AND char_length(v_source_sheet) > 200)
     OR (v_source_age_band IS NOT NULL AND char_length(v_source_age_band) > 100)
     OR (p_source_row IS NOT NULL AND p_source_row <= 0) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF v_existing.deleted_at IS NULL
     AND v_is_active
     AND public.pp_comp_schedule_overlaps_live(
       v_existing.product_id,
       v_existing.age_min,
       v_existing.age_max,
       v_existing.effective_from,
       v_effective_to,
       v_existing.id
     ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  UPDATE public.product_compensation_schedules
  SET effective_to = CASE WHEN p_effective_to IS NULL THEN effective_to ELSE p_effective_to END,
      is_active = v_is_active,
      source_file = v_source_file,
      source_sheet = v_source_sheet,
      source_row = CASE WHEN p_source_row IS NULL THEN source_row ELSE p_source_row END,
      source_age_band = v_source_age_band
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.update_product_compensation_schedule(
  uuid, date, boolean, text, text, integer, text
) IS
  'Owner-only. May change effective_to, is_active, and source metadata. Cannot change product, ages, rates, or effective_from in place.';

CREATE OR REPLACE FUNCTION public.deactivate_product_compensation_schedule(p_id uuid)
RETURNS public.product_compensation_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_existing public.product_compensation_schedules;
  v_row public.product_compensation_schedules;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing
  FROM public.product_compensation_schedules
  WHERE id = p_id
  FOR UPDATE;
  IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  UPDATE public.product_compensation_schedules
  SET is_active = false
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.deactivate_product_compensation_schedule(uuid) IS
  'Owner-only. Sets is_active = false. No authenticated hard delete; use the delete guard.';

REVOKE ALL ON FUNCTION public.create_product_compensation_schedule(
  uuid, smallint, smallint, numeric, numeric, numeric, numeric, date, date, text, text, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_compensation_schedule(
  uuid, smallint, smallint, numeric, numeric, numeric, numeric, date, date, text, text, integer, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_product_compensation_schedule(
  uuid, date, boolean, text, text, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_product_compensation_schedule(
  uuid, date, boolean, text, text, integer, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.deactivate_product_compensation_schedule(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_product_compensation_schedule(uuid)
  TO authenticated;

-- =============================================================================
-- SECTION D — RLS / grants
-- Raw FA/SFA/SM/ED grids are owner-readable only. Advisors get zero rows.
-- =============================================================================

ALTER TABLE public.product_compensation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_compensation_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_compensation_schedules_select
  ON public.product_compensation_schedules;
CREATE POLICY product_compensation_schedules_select
  ON public.product_compensation_schedules
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.crm_is_owner()
  );

REVOKE ALL ON TABLE public.product_compensation_schedules FROM PUBLIC;
REVOKE ALL ON TABLE public.product_compensation_schedules FROM anon;
REVOKE ALL ON TABLE public.product_compensation_schedules FROM authenticated;

GRANT SELECT ON TABLE public.product_compensation_schedules TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_compensation_schedules
  FROM authenticated;

GRANT ALL ON TABLE public.product_compensation_schedules TO service_role;

REVOKE ALL ON FUNCTION public.pp_apply_allocations(uuid, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_allocation_immutability()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_advisor_profile_protected_columns()
  FROM PUBLIC, anon, authenticated;
