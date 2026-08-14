-- 032_policy_production_foundation.sql
-- Policy Production Phase P1A — hardened backend foundation.
--
-- Adds the carrier/product catalog, the policy application production record,
-- its participant / allocation / stage-history satellites, and the SECURITY
-- DEFINER RPC surface that is the ONLY authenticated write path.
--
-- Tables:
--   carriers
--   insurance_products
--   policy_applications
--   policy_application_participants
--   policy_application_stage_history   (append-only)
--   policy_agent_allocations
--   public.policies.source_application_id (new column + permanent unique)
--
-- Application <-> policy relationship: there is exactly ONE link column,
-- public.policies.source_application_id. policy_applications carries no mirror
-- of it, so there is no circular FK and no pair of columns that can disagree.
-- The linked policy is always resolved by querying
-- policies WHERE source_application_id = <application id>, and the uniqueness
-- of that column is permanent (it includes soft-deleted policies), so an
-- application can never acquire a second policy.
--
-- RPCs (authenticated):
--   create_carrier, update_carrier
--   create_insurance_product, update_insurance_product
--   create_policy_application, update_policy_application
--   set_policy_application_participants, set_policy_application_allocations
--   transition_policy_application_stage
--   set_policy_application_number, correct_policy_application_number
--   soft_delete_policy_application
--
-- Error contract: every RPC/trigger failure raises 'CRM_PP:<code>'.
--   not_authenticated, not_authorized, not_found, invalid_payload,
--   invalid_transition, invalid_disposition, invalid_delivery_status,
--   missing_required_fields, invalid_premium, invalid_allocations,
--   invalid_participants, household_mismatch, duplicate_application_number,
--   duplicate_policy_number, duplicate_link, catalog_inactive, catalog_in_use,
--   delete_not_allowed, identifier_locked, advisor_invalid, issue_failed,
--   participant_change_denied
--
-- P1 scope limitations (deliberate, documented at the bottom of this file):
--   * FIA supports exactly ONE current annuitant. Multi-annuitant / joint
--     annuitant contracts are deferred.
--   * Survivorship and multi-insured life cases are deferred (single current
--     'insured' participant).
--   * policies.premium is NEVER used to carry an FIA deposit; the deposit
--     lives in policy_applications.annuity_deposit_cents and is mirrored into
--     policies.details.
--
-- Does NOT: commission expectations / commission transactions, underwriting
-- requirements or medical data, activity inserts or record_crm_activity
-- expansion, opportunity stage changes, cases/workflow tables, or any UI.

-- =============================================================================
-- SECTION A — Enums
-- =============================================================================

DO $$
BEGIN
  CREATE TYPE public.policy_application_stage AS ENUM (
    'draft',
    'pre_submitted',
    'submitted',
    'in_underwriting',
    'approved',
    'declined',
    'postponed',
    'withdrawn',
    'incomplete',
    'not_taken',
    'issued',
    'in_force'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.policy_underwriting_disposition AS ENUM (
    'pending',
    'approved_as_applied',
    'approved_other_than_applied',
    'approved_with_amendment',
    'declined',
    'postponed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.policy_delivery_status AS ENUM (
    'pre_issue',
    'not_started',
    'with_agent',
    'with_client',
    'requirements_pending',
    'complete',
    'not_required'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.insurance_product_line AS ENUM (
    'life_term',
    'life_permanent',
    'fia'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.policy_allocation_role AS ENUM (
    'writing',
    'servicing'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.policy_allocation_recipient_type AS ENUM (
    'advisor',
    'house'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.policy_participant_role AS ENUM (
    'primary_client',
    'insured',
    'owner',
    'joint_owner',
    'annuitant',
    'payor'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- SECTION B — Error helper, normalizers, jsonb parsing helpers
-- =============================================================================

-- Single raise point so every failure carries the 'CRM_PP:<code>' contract.
-- SQLSTATE mapping is intentionally coarse: 42501 for authorization, P0002 for
-- missing rows, 22023 for everything else. Duplicates deliberately do NOT use
-- 23505 so that internal `EXCEPTION WHEN unique_violation` handlers cannot
-- accidentally swallow an already-translated error.
CREATE OR REPLACE FUNCTION public.pp_raise(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_code text := COALESCE(NULLIF(btrim(p_code), ''), 'invalid_payload');
  v_state text;
BEGIN
  v_state := CASE v_code
    WHEN 'not_authenticated' THEN '42501'
    WHEN 'not_authorized' THEN '42501'
    WHEN 'advisor_invalid' THEN '42501'
    WHEN 'identifier_locked' THEN '42501'
    WHEN 'delete_not_allowed' THEN '42501'
    WHEN 'participant_change_denied' THEN '42501'
    WHEN 'not_found' THEN 'P0002'
    ELSE '22023'
  END;
  RAISE EXCEPTION 'CRM_PP:%', v_code USING ERRCODE = v_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_normalize_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT NULLIF(lower(btrim(regexp_replace(COALESCE(p_value, ''), '\s+', ' ', 'g'))), '');
$$;

-- Carrier codes are compared case-insensitively with all whitespace removed so
-- 'F & G', 'f&g' and 'F&G' collide instead of creating catalog duplicates.
CREATE OR REPLACE FUNCTION public.pp_normalize_carrier_code(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT NULLIF(lower(regexp_replace(COALESCE(p_value, ''), '\s', '', 'g')), '');
$$;

CREATE OR REPLACE FUNCTION public.pp_assert_payload_size(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF octet_length(p_payload::text) > 65536 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_assert_object_keys(
  p_obj jsonb,
  p_allowed text[],
  p_code text DEFAULT 'invalid_payload'
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_obj IS NULL OR jsonb_typeof(p_obj) <> 'object' THEN
    PERFORM public.pp_raise(p_code);
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_obj) AS k
    WHERE NOT (k = ANY (COALESCE(p_allowed, ARRAY[]::text[])))
  ) THEN
    PERFORM public.pp_raise(p_code);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_json_text(p_obj jsonb, p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN p_obj IS NULL OR NOT (p_obj ? p_key) THEN NULL
    ELSE NULLIF(btrim(COALESCE(p_obj ->> p_key, '')), '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.pp_json_uuid(
  p_obj jsonb,
  p_key text,
  p_code text DEFAULT 'invalid_payload'
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := public.pp_json_text(p_obj, p_key);
  v_out uuid;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::uuid;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_json_int(
  p_obj jsonb,
  p_key text,
  p_code text DEFAULT 'invalid_payload'
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := public.pp_json_text(p_obj, p_key);
  v_out integer;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::integer;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_json_bigint(
  p_obj jsonb,
  p_key text,
  p_code text DEFAULT 'invalid_payload'
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := public.pp_json_text(p_obj, p_key);
  v_out bigint;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::bigint;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_json_date(
  p_obj jsonb,
  p_key text,
  p_code text DEFAULT 'invalid_payload'
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := public.pp_json_text(p_obj, p_key);
  v_out date;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::date;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_json_bool(
  p_obj jsonb,
  p_key text,
  p_default boolean DEFAULT NULL,
  p_code text DEFAULT 'invalid_payload'
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := public.pp_json_text(p_obj, p_key);
  v_out boolean;
BEGIN
  IF v_raw IS NULL THEN RETURN p_default; END IF;
  BEGIN
    v_out := v_raw::boolean;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_parse_product_line(
  p_value text,
  p_code text DEFAULT 'invalid_payload'
)
RETURNS public.insurance_product_line
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := NULLIF(lower(btrim(COALESCE(p_value, ''))), '');
  v_out public.insurance_product_line;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::public.insurance_product_line;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_parse_stage(
  p_value text,
  p_code text DEFAULT 'invalid_transition'
)
RETURNS public.policy_application_stage
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := NULLIF(lower(btrim(COALESCE(p_value, ''))), '');
  v_out public.policy_application_stage;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::public.policy_application_stage;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_parse_disposition(
  p_value text,
  p_code text DEFAULT 'invalid_disposition'
)
RETURNS public.policy_underwriting_disposition
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := NULLIF(lower(btrim(COALESCE(p_value, ''))), '');
  v_out public.policy_underwriting_disposition;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::public.policy_underwriting_disposition;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_parse_delivery_status(
  p_value text,
  p_code text DEFAULT 'invalid_delivery_status'
)
RETURNS public.policy_delivery_status
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := NULLIF(lower(btrim(COALESCE(p_value, ''))), '');
  v_out public.policy_delivery_status;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::public.policy_delivery_status;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_parse_participant_role(
  p_value text,
  p_code text DEFAULT 'invalid_participants'
)
RETURNS public.policy_participant_role
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := NULLIF(lower(btrim(COALESCE(p_value, ''))), '');
  v_out public.policy_participant_role;
BEGIN
  IF v_raw IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_out := v_raw::public.policy_participant_role;
  EXCEPTION WHEN others THEN
    PERFORM public.pp_raise(p_code);
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_premium_mode_is_valid(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT p_value IS NULL
    OR p_value IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'single', 'other');
$$;

-- policies.payment_frequency is free text; keep the production vocabulary
-- stable rather than inventing carrier-specific labels at issue time.
CREATE OR REPLACE FUNCTION public.pp_payment_frequency_from_mode(p_mode text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN p_mode IS NULL THEN NULL
    WHEN p_mode IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'single') THEN p_mode
    ELSE 'other'
  END;
$$;

REVOKE ALL ON FUNCTION public.pp_raise(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_normalize_text(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_normalize_carrier_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_payload_size(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_object_keys(jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_json_text(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_json_uuid(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_json_int(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_json_bigint(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_json_date(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_json_bool(jsonb, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_parse_product_line(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_parse_stage(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_parse_disposition(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_parse_delivery_status(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_parse_participant_role(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_premium_mode_is_valid(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_payment_frequency_from_mode(text) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION C — Catalog tables: carriers, insurance_products
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.carriers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  code_normalized text NOT NULL,
  name_normalized text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT carriers_code_trimmed_check
    CHECK (code = btrim(code) AND char_length(code) BETWEEN 1 AND 40),
  CONSTRAINT carriers_name_trimmed_check
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT carriers_code_normalized_shape_check
    CHECK (
      code_normalized = lower(code_normalized)
      AND code_normalized = btrim(code_normalized)
      AND char_length(code_normalized) BETWEEN 1 AND 40
    ),
  CONSTRAINT carriers_name_normalized_shape_check
    CHECK (
      name_normalized = lower(name_normalized)
      AND name_normalized = btrim(name_normalized)
      AND char_length(name_normalized) BETWEEN 1 AND 200
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS carriers_code_normalized_unique_idx
  ON public.carriers (code_normalized)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS carriers_name_normalized_unique_idx
  ON public.carriers (name_normalized)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS carriers_active_name_idx
  ON public.carriers (name_normalized)
  WHERE deleted_at IS NULL AND is_active = true;

COMMENT ON TABLE public.carriers IS
  'Insurance carrier catalog. Owner-managed via RPC. Soft delete only; deactivate instead of deleting.';
COMMENT ON COLUMN public.carriers.code_normalized IS
  'pp_normalize_carrier_code(code). Collision key for active carriers.';
COMMENT ON COLUMN public.carriers.name_normalized IS
  'pp_normalize_text(name). Collision key for active carriers.';

CREATE TABLE IF NOT EXISTS public.insurance_products (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES public.carriers (id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_normalized text NOT NULL,
  product_line public.insurance_product_line NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT insurance_products_name_trimmed_check
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT insurance_products_name_normalized_shape_check
    CHECK (
      name_normalized = lower(name_normalized)
      AND name_normalized = btrim(name_normalized)
      AND char_length(name_normalized) BETWEEN 1 AND 200
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS insurance_products_carrier_name_unique_idx
  ON public.insurance_products (carrier_id, name_normalized)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS insurance_products_carrier_idx
  ON public.insurance_products (carrier_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS insurance_products_line_idx
  ON public.insurance_products (product_line)
  WHERE deleted_at IS NULL AND is_active = true;

COMMENT ON TABLE public.insurance_products IS
  'Carrier product catalog. product_line drives premium/participant/issuance rules downstream.';

-- =============================================================================
-- SECTION D — policy_applications
--
-- The table is created complete, in one place. It holds no column pointing
-- back at public.policies, so nothing here references that table and the create
-- order is simply:
--   1. create policy_applications               (this section)
--   2. alter policies add source_application_id  (SECTION E)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.policy_applications (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE SET NULL,
  carrier_id uuid NOT NULL REFERENCES public.carriers (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.insurance_products (id) ON DELETE RESTRICT,
  product_line public.insurance_product_line NOT NULL,

  state text NOT NULL,

  application_number text,
  application_number_normalized text,
  policy_number text,
  policy_number_normalized text,

  is_replacement boolean NOT NULL DEFAULT false,
  is_exchange_or_transfer boolean NOT NULL DEFAULT false,

  face_amount_cents bigint,
  annuity_deposit_cents bigint,
  premium_mode text,
  submitted_premium_cents bigint,
  target_premium_cents bigint,

  -- Manual production snapshot. P1 does NOT compute points; the owner records
  -- the scaled integer they expect and it is never derived from allocations.
  total_points_scaled integer,

  production_stage public.policy_application_stage NOT NULL DEFAULT 'draft',
  underwriting_disposition public.policy_underwriting_disposition NOT NULL DEFAULT 'pending',
  delivery_status public.policy_delivery_status NOT NULL DEFAULT 'pre_issue',

  submission_date date,
  decision_date date,
  issue_date date,
  in_force_date date,
  next_follow_up_date date,

  production_month date,

  notes text,

  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT policy_applications_state_check
    CHECK (state ~ '^[A-Z]{2}$'),

  CONSTRAINT policy_applications_application_number_shape_check
    CHECK (
      application_number IS NULL
      OR (application_number = btrim(application_number)
          AND char_length(application_number) BETWEEN 1 AND 60)
    ),
  CONSTRAINT policy_applications_application_number_pair_check
    CHECK ((application_number IS NULL) = (application_number_normalized IS NULL)),
  CONSTRAINT policy_applications_application_number_normalized_shape_check
    CHECK (
      application_number_normalized IS NULL
      OR (application_number_normalized = lower(application_number_normalized)
          AND application_number_normalized = btrim(application_number_normalized)
          AND char_length(application_number_normalized) BETWEEN 1 AND 60)
    ),
  CONSTRAINT policy_applications_policy_number_shape_check
    CHECK (
      policy_number IS NULL
      OR (policy_number = btrim(policy_number)
          AND char_length(policy_number) BETWEEN 1 AND 60)
    ),
  CONSTRAINT policy_applications_policy_number_pair_check
    CHECK ((policy_number IS NULL) = (policy_number_normalized IS NULL)),
  CONSTRAINT policy_applications_policy_number_normalized_shape_check
    CHECK (
      policy_number_normalized IS NULL
      OR (policy_number_normalized = lower(policy_number_normalized)
          AND policy_number_normalized = btrim(policy_number_normalized)
          AND char_length(policy_number_normalized) BETWEEN 1 AND 60)
    ),

  CONSTRAINT policy_applications_face_amount_nonnegative_check
    CHECK (face_amount_cents IS NULL OR face_amount_cents >= 0),
  CONSTRAINT policy_applications_annuity_deposit_nonnegative_check
    CHECK (annuity_deposit_cents IS NULL OR annuity_deposit_cents >= 0),
  CONSTRAINT policy_applications_submitted_premium_nonnegative_check
    CHECK (submitted_premium_cents IS NULL OR submitted_premium_cents >= 0),
  CONSTRAINT policy_applications_target_premium_nonnegative_check
    CHECK (target_premium_cents IS NULL OR target_premium_cents >= 0),
  CONSTRAINT policy_applications_total_points_nonnegative_check
    CHECK (total_points_scaled IS NULL OR total_points_scaled >= 0),

  CONSTRAINT policy_applications_premium_mode_check
    CHECK (
      premium_mode IS NULL
      OR premium_mode IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'single', 'other')
    ),

  -- Soft product-line shape checks: life carries face amount + modal premium,
  -- FIA carries a single deposit. policies.premium is never used for the FIA
  -- deposit, so the annuity amount must not leak into the premium columns.
  CONSTRAINT policy_applications_life_shape_check
    CHECK (product_line = 'fia' OR annuity_deposit_cents IS NULL),
  CONSTRAINT policy_applications_fia_shape_check
    CHECK (
      product_line <> 'fia'
      OR (face_amount_cents IS NULL AND target_premium_cents IS NULL)
    ),

  CONSTRAINT policy_applications_production_month_first_of_month_check
    CHECK (production_month IS NULL OR extract(day FROM production_month) = 1),

  CONSTRAINT policy_applications_issue_after_submission_check
    CHECK (issue_date IS NULL OR submission_date IS NULL OR issue_date >= submission_date),
  CONSTRAINT policy_applications_in_force_after_issue_check
    CHECK (in_force_date IS NULL OR issue_date IS NULL OR in_force_date >= issue_date),

  CONSTRAINT policy_applications_notes_len_check
    CHECK (notes IS NULL OR char_length(notes) <= 5000),

  -- Stage/disposition matrix mirrored from pp_validate_stage_disposition.
  CONSTRAINT policy_applications_stage_disposition_check
    CHECK (
      CASE
        WHEN production_stage IN ('draft', 'pre_submitted', 'submitted', 'in_underwriting')
          THEN underwriting_disposition = 'pending'
        WHEN production_stage IN ('approved', 'issued', 'in_force')
          THEN underwriting_disposition IN (
            'approved_as_applied',
            'approved_other_than_applied',
            'approved_with_amendment'
          )
        WHEN production_stage = 'declined' THEN underwriting_disposition = 'declined'
        WHEN production_stage = 'postponed' THEN underwriting_disposition = 'postponed'
        ELSE true
      END
    ),

  -- Delivery tracking only becomes meaningful once a contract is issued, and an
  -- in-force contract must have reached a terminal delivery outcome: either the
  -- delivery completed, or it was explicitly recorded as not required.
  CONSTRAINT policy_applications_delivery_stage_check
    CHECK (
      CASE
        WHEN production_stage = 'in_force'
          THEN delivery_status IN ('complete', 'not_required')
        WHEN production_stage = 'issued'
          THEN delivery_status <> 'pre_issue'
        ELSE delivery_status IN ('pre_issue', 'not_required')
      END
    )
);

CREATE INDEX IF NOT EXISTS policy_applications_household_idx
  ON public.policy_applications (household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS policy_applications_stage_idx
  ON public.policy_applications (production_stage, next_follow_up_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS policy_applications_carrier_idx
  ON public.policy_applications (carrier_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS policy_applications_product_idx
  ON public.policy_applications (product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS policy_applications_opportunity_idx
  ON public.policy_applications (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS policy_applications_production_month_idx
  ON public.policy_applications (production_month)
  WHERE deleted_at IS NULL AND production_month IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS policy_applications_carrier_app_number_unique_idx
  ON public.policy_applications (carrier_id, application_number_normalized)
  WHERE application_number_normalized IS NOT NULL AND deleted_at IS NULL;

-- Carrier policy numbers collide case-insensitively. There is deliberately no
-- deleted_at filter: only draft / pre_submitted applications can be soft
-- deleted and those never carry a carrier-issued policy number, so a
-- soft-deleted row with a policy number is already an anomaly and must not be
-- allowed to hand the same number to a second application.
CREATE UNIQUE INDEX IF NOT EXISTS policy_applications_carrier_policy_number_unique_idx
  ON public.policy_applications (carrier_id, policy_number_normalized)
  WHERE policy_number_normalized IS NOT NULL;

COMMENT ON TABLE public.policy_applications IS
  'Policy production record: one row per submitted/pending application. Writes only via CRM_PP RPCs.';
COMMENT ON COLUMN public.policy_applications.total_points_scaled IS
  'Manual production points snapshot (scaled integer). Never derived; P1 does not compute points.';
COMMENT ON COLUMN public.policy_applications.production_month IS
  'Optional production period bucket. First day of month when set.';
COMMENT ON COLUMN public.policy_applications.annuity_deposit_cents IS
  'FIA single deposit. Never mapped onto policies.premium; mirrored into policies.details at issue.';
COMMENT ON COLUMN public.policy_applications.policy_number_normalized IS
  'pp_normalize_text(policy_number). Collision key for carrier policy numbers; kept in lockstep with policy_number by the RPCs.';
COMMENT ON INDEX public.policy_applications_carrier_policy_number_unique_idx IS
  'One carrier policy number per carrier, case-insensitively, across every application including soft-deleted ones.';

-- =============================================================================
-- SECTION E — policies.source_application_id
--
-- The single, one-directional link between an application and the policy it
-- produced. policy_applications does NOT mirror it back.
-- =============================================================================

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS source_application_id uuid
    REFERENCES public.policy_applications (id) ON DELETE SET NULL;

-- Unconditional uniqueness: no deleted_at predicate. The link is permanent, so
-- soft-deleting a linked policy can never free the application to be issued a
-- replacement policy.
CREATE UNIQUE INDEX IF NOT EXISTS policies_source_application_unique_idx
  ON public.policies (source_application_id)
  WHERE source_application_id IS NOT NULL;

COMMENT ON COLUMN public.policies.source_application_id IS
  'Policy Production link, and the only link between the two tables. Set exactly once by transition_policy_application_stage on issue, immutable afterwards. Guarded by enforce_policies_pp_link_guard.';
COMMENT ON INDEX public.policies_source_application_unique_idx IS
  'One policy per application, permanently: the uniqueness includes soft-deleted policies so an application can never be issued a second, replacement policy.';

-- =============================================================================
-- SECTION F — Satellites: participants, stage history, allocations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.policy_application_participants (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.policy_applications (id) ON DELETE CASCADE,
  household_member_id uuid NOT NULL REFERENCES public.household_members (id) ON DELETE CASCADE,
  role public.policy_participant_role NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  change_reason text,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_application_participants_effective_range_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT policy_application_participants_reason_len_check
    CHECK (change_reason IS NULL OR char_length(change_reason) BETWEEN 1 AND 500)
);

-- Singleton roles: at most one CURRENT primary_client / insured / owner /
-- annuitant per application. joint_owner and payor intentionally allow multiple
-- concurrent rows. The annuitant singleton is the documented P1 FIA limitation.
CREATE UNIQUE INDEX IF NOT EXISTS policy_application_participants_singleton_role_idx
  ON public.policy_application_participants (application_id, role)
  WHERE effective_to IS NULL
    AND role IN ('primary_client', 'insured', 'owner', 'annuitant');

-- A member may hold several roles, but not the same role twice concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS policy_application_participants_member_role_idx
  ON public.policy_application_participants (application_id, household_member_id, role)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS policy_application_participants_current_idx
  ON public.policy_application_participants (application_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS policy_application_participants_member_idx
  ON public.policy_application_participants (household_member_id);

COMMENT ON TABLE public.policy_application_participants IS
  'Effective-dated application roles. Supersede by closing effective_to; rows are never rewritten. joint_owner/payor may repeat concurrently.';

CREATE TABLE IF NOT EXISTS public.policy_application_stage_history (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.policy_applications (id) ON DELETE CASCADE,
  from_stage public.policy_application_stage,
  to_stage public.policy_application_stage NOT NULL,
  from_disposition public.policy_underwriting_disposition,
  to_disposition public.policy_underwriting_disposition,
  from_delivery_status public.policy_delivery_status,
  to_delivery_status public.policy_delivery_status,
  reason text,
  changed_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_application_stage_history_reason_len_check
    CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS policy_application_stage_history_application_idx
  ON public.policy_application_stage_history (application_id, changed_at DESC);

COMMENT ON TABLE public.policy_application_stage_history IS
  'Append-only stage/disposition/delivery audit trail. No updated_at, no deleted_at, no UPDATE, no client DELETE.';

CREATE TABLE IF NOT EXISTS public.policy_agent_allocations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.policy_applications (id) ON DELETE CASCADE,
  recipient_type public.policy_allocation_recipient_type NOT NULL,
  advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  allocation_role public.policy_allocation_role NOT NULL,
  commission_bps integer NOT NULL,
  production_credit_bps integer NOT NULL,
  contract_level_snapshot text,
  points_share_scaled integer,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  change_reason text,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT policy_agent_allocations_commission_bps_range_check
    CHECK (commission_bps BETWEEN 0 AND 10000),
  CONSTRAINT policy_agent_allocations_production_credit_bps_range_check
    CHECK (production_credit_bps BETWEEN 0 AND 10000),
  CONSTRAINT policy_agent_allocations_points_share_nonnegative_check
    CHECK (points_share_scaled IS NULL OR points_share_scaled >= 0),
  CONSTRAINT policy_agent_allocations_recipient_advisor_check
    CHECK (
      (recipient_type = 'advisor' AND advisor_id IS NOT NULL)
      OR (recipient_type = 'house' AND advisor_id IS NULL)
    ),
  -- Servicing rows carry no economics; they exist for ownership of service work.
  CONSTRAINT policy_agent_allocations_servicing_zero_check
    CHECK (
      allocation_role <> 'servicing'
      OR (commission_bps = 0 AND production_credit_bps = 0)
    ),
  CONSTRAINT policy_agent_allocations_effective_range_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT policy_agent_allocations_contract_level_len_check
    CHECK (
      contract_level_snapshot IS NULL
      OR (contract_level_snapshot = btrim(contract_level_snapshot)
          AND char_length(contract_level_snapshot) BETWEEN 1 AND 60)
    ),
  CONSTRAINT policy_agent_allocations_reason_len_check
    CHECK (change_reason IS NULL OR char_length(change_reason) BETWEEN 1 AND 500)
);

-- At most one CURRENT house writing allocation per application.
CREATE UNIQUE INDEX IF NOT EXISTS policy_agent_allocations_house_writing_idx
  ON public.policy_agent_allocations (application_id)
  WHERE recipient_type = 'house'
    AND allocation_role = 'writing'
    AND effective_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS policy_agent_allocations_advisor_role_idx
  ON public.policy_agent_allocations (application_id, advisor_id, allocation_role)
  WHERE advisor_id IS NOT NULL AND effective_to IS NULL;

CREATE INDEX IF NOT EXISTS policy_agent_allocations_current_idx
  ON public.policy_agent_allocations (application_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS policy_agent_allocations_advisor_idx
  ON public.policy_agent_allocations (advisor_id)
  WHERE advisor_id IS NOT NULL AND effective_to IS NULL;

COMMENT ON TABLE public.policy_agent_allocations IS
  'Effective-dated split of commission_bps and production_credit_bps. Writing rows (incl. house) sum to 10000 on each axis independently; servicing rows are zeroed and excluded from the totals.';
COMMENT ON COLUMN public.policy_agent_allocations.contract_level_snapshot IS
  'Free-text contract level captured at allocation time. Historical; never recomputed.';
COMMENT ON COLUMN public.policy_agent_allocations.points_share_scaled IS
  'Optional manual points share snapshot. P1 does not compute or reconcile this.';

-- =============================================================================
-- SECTION G — Access + validation helpers
-- =============================================================================

-- Requires an authenticated, active CRM principal. Advisors additionally need a
-- resolvable active advisor_profiles row.
CREATE OR REPLACE FUNCTION public.pp_assert_authenticated()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.pp_raise('not_authenticated');
  END IF;
  IF NOT (public.crm_is_owner() OR public.crm_is_advisor()) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;
  IF public.crm_is_advisor() AND NOT public.crm_is_owner() AND public.crm_advisor_id() IS NULL THEN
    PERFORM public.pp_raise('advisor_invalid');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_assert_owner()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  PERFORM public.pp_assert_authenticated();
  IF NOT public.crm_is_owner() THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;
END;
$$;

-- Owners see every application including soft-deleted ones. Advisors see only
-- live applications on households they are assigned to.
CREATE OR REPLACE FUNCTION public.pp_can_access_application(p_application_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.policy_applications a
    WHERE a.id = p_application_id
      AND (
        public.crm_is_owner()
        OR (a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))
      )
  );
$$;

-- Invisible applications report not_found rather than not_authorized so that
-- advisors cannot enumerate other households' production.
CREATE OR REPLACE FUNCTION public.pp_assert_can_access_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  PERFORM public.pp_assert_authenticated();
  IF p_application_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF NOT public.pp_can_access_application(p_application_id) THEN
    PERFORM public.pp_raise('not_found');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_validate_stage_disposition(
  p_stage public.policy_application_stage,
  p_disposition public.policy_underwriting_disposition
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_stage IS NULL OR p_disposition IS NULL THEN
    PERFORM public.pp_raise('invalid_disposition');
  END IF;

  CASE p_stage
    WHEN 'draft', 'pre_submitted', 'submitted', 'in_underwriting' THEN
      IF p_disposition <> 'pending' THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'approved', 'issued', 'in_force' THEN
      IF p_disposition NOT IN (
        'approved_as_applied',
        'approved_other_than_applied',
        'approved_with_amendment'
      ) THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'declined' THEN
      IF p_disposition <> 'declined' THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'postponed' THEN
      IF p_disposition <> 'postponed' THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'withdrawn', 'incomplete', 'not_taken' THEN
      -- Abandonment retains whatever disposition the carrier had reached.
      NULL;
    ELSE
      PERFORM public.pp_raise('invalid_disposition');
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_assert_delivery_status_allowed(
  p_stage public.policy_application_stage,
  p_delivery_status public.policy_delivery_status
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_stage IS NULL OR p_delivery_status IS NULL THEN
    PERFORM public.pp_raise('invalid_delivery_status');
  END IF;

  IF p_stage = 'in_force' THEN
    -- An in-force contract has a settled delivery outcome: it was delivered, or
    -- delivery was explicitly recorded as not required.
    IF p_delivery_status NOT IN ('complete', 'not_required') THEN
      PERFORM public.pp_raise('invalid_delivery_status');
    END IF;
  ELSIF p_stage = 'issued' THEN
    IF p_delivery_status = 'pre_issue' THEN
      PERFORM public.pp_raise('invalid_delivery_status');
    END IF;
  ELSE
    -- Before issue the only meaningful values are the pre-issue placeholder and
    -- an explicit "delivery does not apply" opt-out.
    IF p_delivery_status NOT IN ('pre_issue', 'not_required') THEN
      PERFORM public.pp_raise('invalid_delivery_status');
    END IF;
  END IF;
END;
$$;

-- The in_force delivery gate. Going in force is the point at which delivery
-- must be settled, so the in-flight statuses are all rejected and the
-- "not required" opt-out has to be justified: a reason is mandatory, and on
-- life business only the owner may waive delivery.
CREATE OR REPLACE FUNCTION public.pp_assert_in_force_delivery(
  p_product_line public.insurance_product_line,
  p_delivery public.policy_delivery_status,
  p_is_owner boolean,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF p_product_line IS NULL OR p_delivery IS NULL THEN
    PERFORM public.pp_raise('invalid_delivery_status');
  END IF;

  IF p_delivery IN (
    'pre_issue', 'not_started', 'with_agent', 'with_client', 'requirements_pending'
  ) THEN
    PERFORM public.pp_raise('invalid_delivery_status');
  END IF;

  IF p_delivery = 'complete' THEN
    RETURN;
  END IF;

  IF p_delivery = 'not_required' THEN
    IF v_reason IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
    -- Life delivery is a compliance obligation; waiving it is an owner call.
    -- FIA contracts have no delivery requirement, so an advisor may waive with
    -- a reason on record.
    IF p_product_line IN ('life_term', 'life_permanent')
       AND NOT COALESCE(p_is_owner, false) THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN;
  END IF;

  PERFORM public.pp_raise('invalid_delivery_status');
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_is_terminal_stage(p_stage public.policy_application_stage)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT p_stage IN ('declined', 'withdrawn', 'incomplete', 'not_taken', 'in_force');
$$;

-- The only sanctioned backward moves. Each requires a reason.
CREATE OR REPLACE FUNCTION public.pp_is_backward_transition(
  p_from public.policy_application_stage,
  p_to public.policy_application_stage
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT (p_from = 'in_underwriting' AND p_to = 'submitted')
      OR (p_from = 'postponed' AND p_to = 'in_underwriting')
      OR (p_from = 'approved' AND p_to = 'in_underwriting');
$$;

-- Full P1 state machine. Terminal stages have no outgoing edges: there is no
-- in_force -> issued, no issued -> approved, and no reopening a declined,
-- withdrawn, incomplete or not_taken application.
CREATE OR REPLACE FUNCTION public.pp_assert_transition_allowed(
  p_from public.policy_application_stage,
  p_to public.policy_application_stage,
  p_is_owner boolean
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_allowed boolean := false;
  v_owner_only boolean := false;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  CASE p_from
    WHEN 'draft' THEN
      v_allowed := p_to IN ('pre_submitted', 'submitted', 'withdrawn');
    WHEN 'pre_submitted' THEN
      v_allowed := p_to IN ('submitted', 'withdrawn');
    WHEN 'submitted' THEN
      v_allowed := p_to IN ('in_underwriting', 'withdrawn', 'incomplete');
    WHEN 'in_underwriting' THEN
      v_allowed := p_to IN (
        'submitted', 'approved', 'declined', 'postponed',
        'withdrawn', 'incomplete'
      );
    WHEN 'postponed' THEN
      v_allowed := p_to IN ('in_underwriting', 'withdrawn', 'declined');
    WHEN 'approved' THEN
      IF p_to = 'in_underwriting' THEN
        v_allowed := true;
        v_owner_only := true;
      ELSE
        v_allowed := p_to IN ('issued', 'not_taken', 'withdrawn');
      END IF;
    WHEN 'issued' THEN
      v_allowed := p_to IN ('in_force', 'not_taken');
    WHEN 'in_force', 'declined', 'withdrawn', 'incomplete', 'not_taken' THEN
      v_allowed := false;
    ELSE
      v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  IF v_owner_only AND NOT COALESCE(p_is_owner, false) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;
END;
$$;

-- Validates a complete allocation set (the payload form and the materialized
-- current form share this function). Writing rows, including the house row, must
-- sum to exactly 10000 bps on commission and on production credit
-- independently. Servicing rows must be zeroed and are excluded from the sums.
CREATE OR REPLACE FUNCTION public.pp_assert_allocations_valid(p_allocations jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_allowed_keys text[] := ARRAY[
    'recipient_type',
    'advisor_id',
    'allocation_role',
    'commission_bps',
    'production_credit_bps',
    'contract_level_snapshot',
    'points_share_scaled'
  ];
  v_el jsonb;
  v_recipient text;
  v_role text;
  v_advisor uuid;
  v_commission integer;
  v_credit integer;
  v_points integer;
  v_contract text;
  v_writing_commission bigint := 0;
  v_writing_credit bigint := 0;
  v_writing_rows integer := 0;
  v_house_writing integer := 0;
  v_signatures text[] := ARRAY[]::text[];
  v_signature text;
BEGIN
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;
  IF jsonb_array_length(p_allocations) = 0 OR jsonb_array_length(p_allocations) > 20 THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;

  FOR v_el IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF jsonb_typeof(v_el) <> 'object' THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;
    PERFORM public.pp_assert_object_keys(v_el, v_allowed_keys, 'invalid_allocations');

    v_recipient := lower(COALESCE(public.pp_json_text(v_el, 'recipient_type'), ''));
    v_role := lower(COALESCE(public.pp_json_text(v_el, 'allocation_role'), ''));
    IF v_recipient NOT IN ('advisor', 'house') THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;
    IF v_role NOT IN ('writing', 'servicing') THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;

    v_advisor := public.pp_json_uuid(v_el, 'advisor_id', 'invalid_allocations');
    IF v_recipient = 'advisor' AND v_advisor IS NULL THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;
    IF v_recipient = 'house' AND v_advisor IS NOT NULL THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;

    v_commission := public.pp_json_int(v_el, 'commission_bps', 'invalid_allocations');
    v_credit := public.pp_json_int(v_el, 'production_credit_bps', 'invalid_allocations');
    IF v_commission IS NULL OR v_credit IS NULL THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;
    IF v_commission < 0 OR v_commission > 10000 OR v_credit < 0 OR v_credit > 10000 THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;

    v_points := public.pp_json_int(v_el, 'points_share_scaled', 'invalid_allocations');
    IF v_points IS NOT NULL AND v_points < 0 THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;

    v_contract := public.pp_json_text(v_el, 'contract_level_snapshot');
    IF v_contract IS NOT NULL AND char_length(v_contract) > 60 THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;

    IF v_role = 'servicing' THEN
      IF v_commission <> 0 OR v_credit <> 0 THEN
        PERFORM public.pp_raise('invalid_allocations');
      END IF;
    ELSE
      v_writing_rows := v_writing_rows + 1;
      v_writing_commission := v_writing_commission + v_commission;
      v_writing_credit := v_writing_credit + v_credit;
      IF v_recipient = 'house' THEN
        v_house_writing := v_house_writing + 1;
      END IF;
    END IF;

    v_signature := v_recipient || '|' || COALESCE(v_advisor::text, '-') || '|' || v_role;
    IF v_signature = ANY (v_signatures) THEN
      PERFORM public.pp_raise('invalid_allocations');
    END IF;
    v_signatures := array_append(v_signatures, v_signature);
  END LOOP;

  IF v_writing_rows = 0 THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;
  IF v_house_writing > 1 THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;
  IF v_writing_commission <> 10000 OR v_writing_credit <> 10000 THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;
END;
$$;

-- Materializes the current allocation set in the same shape the RPC payload
-- uses so submit-time validation reuses pp_assert_allocations_valid verbatim.
CREATE OR REPLACE FUNCTION public.pp_current_allocations_json(p_application_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'recipient_type', al.recipient_type::text,
          'advisor_id', al.advisor_id,
          'allocation_role', al.allocation_role::text,
          'commission_bps', al.commission_bps,
          'production_credit_bps', al.production_credit_bps,
          'contract_level_snapshot', al.contract_level_snapshot,
          'points_share_scaled', al.points_share_scaled
        )
      )
      ORDER BY al.allocation_role, al.recipient_type, al.advisor_id
    ),
    '[]'::jsonb
  )
  FROM public.policy_agent_allocations al
  WHERE al.application_id = p_application_id
    AND al.effective_to IS NULL;
$$;

-- Submit gate for participants.
--   Life (life_term / life_permanent): exactly one current primary_client,
--     insured and owner. annuitant is not required.
--   FIA: exactly one current primary_client, owner and annuitant. insured is
--     not required. P1 supports a single annuitant only.
-- joint_owner and payor are always optional and may repeat.
CREATE OR REPLACE FUNCTION public.pp_assert_participants_for_submit(
  p_application_id uuid,
  p_product_line public.insurance_product_line
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_primary integer := 0;
  v_insured integer := 0;
  v_owner integer := 0;
  v_annuitant integer := 0;
BEGIN
  IF p_application_id IS NULL OR p_product_line IS NULL THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;

  SELECT
    count(*) FILTER (WHERE pa.role = 'primary_client'),
    count(*) FILTER (WHERE pa.role = 'insured'),
    count(*) FILTER (WHERE pa.role = 'owner'),
    count(*) FILTER (WHERE pa.role = 'annuitant')
  INTO v_primary, v_insured, v_owner, v_annuitant
  FROM public.policy_application_participants pa
  WHERE pa.application_id = p_application_id
    AND pa.effective_to IS NULL;

  IF v_primary <> 1 OR v_owner <> 1 THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;

  IF p_product_line = 'fia' THEN
    IF v_annuitant <> 1 THEN
      PERFORM public.pp_raise('invalid_participants');
    END IF;
  ELSE
    IF v_insured <> 1 THEN
      PERFORM public.pp_raise('invalid_participants');
    END IF;
  END IF;
END;
$$;

-- Submit gate for money (P1 approved rules):
--   Life: submitted_premium_cents > 0 and a valid premium_mode.
--         face_amount_cents and target_premium_cents are optional.
--   FIA:  annuity_deposit_cents > 0. Life premium/mode/face not required.
-- Zero-value money is rejected. Face amount is never required in P1.
CREATE OR REPLACE FUNCTION public.pp_assert_premium_for_submit(
  p_product_line public.insurance_product_line,
  p_face_amount_cents bigint,
  p_annuity_deposit_cents bigint,
  p_submitted_premium_cents bigint,
  p_premium_mode text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_product_line IS NULL THEN
    PERFORM public.pp_raise('invalid_premium');
  END IF;

  IF NOT public.pp_premium_mode_is_valid(p_premium_mode) THEN
    PERFORM public.pp_raise('invalid_premium');
  END IF;

  IF p_product_line = 'fia' THEN
    IF p_annuity_deposit_cents IS NULL OR p_annuity_deposit_cents <= 0 THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
    -- Face / life premium / premium_mode are not required for FIA.
  ELSE
    IF p_submitted_premium_cents IS NULL OR p_submitted_premium_cents <= 0 THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
    IF p_premium_mode IS NULL THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
    IF p_annuity_deposit_cents IS NOT NULL THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
    -- face_amount_cents is optional in P1 (including permanent life).
    IF p_face_amount_cents IS NOT NULL AND p_face_amount_cents <= 0 THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
  END IF;
END;
$$;

-- Validates the catalog triple and returns the resolved product line. Raises
-- catalog_inactive when the carrier or product is deactivated or soft-deleted,
-- and invalid_payload when the product does not belong to the carrier.
CREATE OR REPLACE FUNCTION public.pp_resolve_catalog(
  p_carrier_id uuid,
  p_product_id uuid,
  p_product_line public.insurance_product_line DEFAULT NULL
)
RETURNS public.insurance_product_line
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_carrier public.carriers;
  v_product public.insurance_products;
BEGIN
  IF p_carrier_id IS NULL OR p_product_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  SELECT * INTO v_carrier FROM public.carriers WHERE id = p_carrier_id;
  IF NOT FOUND OR v_carrier.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF NOT v_carrier.is_active THEN
    PERFORM public.pp_raise('catalog_inactive');
  END IF;

  SELECT * INTO v_product FROM public.insurance_products WHERE id = p_product_id;
  IF NOT FOUND OR v_product.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_product.carrier_id <> p_carrier_id THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF NOT v_product.is_active THEN
    PERFORM public.pp_raise('catalog_inactive');
  END IF;

  IF p_product_line IS NOT NULL AND p_product_line <> v_product.product_line THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  RETURN v_product.product_line;
END;
$$;

-- Advisors referenced by an allocation must be live and active.
CREATE OR REPLACE FUNCTION public.pp_assert_advisor_usable(p_advisor_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_advisor_id IS NULL THEN
    PERFORM public.pp_raise('advisor_invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.advisor_profiles ap
    WHERE ap.id = p_advisor_id
      AND ap.deleted_at IS NULL
      AND ap.is_active = true
  ) THEN
    PERFORM public.pp_raise('advisor_invalid');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_assert_authenticated() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_can_access_application(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_can_access_application(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_validate_stage_disposition(
  public.policy_application_stage, public.policy_underwriting_disposition
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_delivery_status_allowed(
  public.policy_application_stage, public.policy_delivery_status
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_in_force_delivery(
  public.insurance_product_line, public.policy_delivery_status, boolean, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_is_terminal_stage(public.policy_application_stage)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_is_backward_transition(
  public.policy_application_stage, public.policy_application_stage
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_transition_allowed(
  public.policy_application_stage, public.policy_application_stage, boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_allocations_valid(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_current_allocations_json(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_participants_for_submit(
  uuid, public.insurance_product_line
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_premium_for_submit(
  public.insurance_product_line, bigint, bigint, bigint, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_resolve_catalog(
  uuid, uuid, public.insurance_product_line
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_advisor_usable(uuid) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION H — Triggers
--
-- Every guard is gated on `auth.uid() IS NOT NULL`, matching the established
-- CRM convention: authenticated clients are bound absolutely, while
-- service_role / migration SQL (auth.uid() IS NULL) stays operational for
-- fixtures and for FK cascades originating from households. The single
-- exception is the immutability of policies.source_application_id, which binds
-- every caller and is documented at enforce_policies_pp_link_guard.
-- =============================================================================

DROP TRIGGER IF EXISTS carriers_set_updated_at ON public.carriers;
CREATE TRIGGER carriers_set_updated_at
  BEFORE UPDATE ON public.carriers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS insurance_products_set_updated_at ON public.insurance_products;
CREATE TRIGGER insurance_products_set_updated_at
  BEFORE UPDATE ON public.insurance_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS policy_applications_set_updated_at ON public.policy_applications;
CREATE TRIGGER policy_applications_set_updated_at
  BEFORE UPDATE ON public.policy_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalog integrity: no hard deletes, and no deleting a carrier/product that
-- production already references.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pp_catalog_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_in_use boolean;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;

  IF TG_TABLE_NAME = 'carriers' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.policy_applications a WHERE a.carrier_id = OLD.id
    ) INTO v_in_use;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.policy_applications a WHERE a.product_id = OLD.id
    ) INTO v_in_use;
  END IF;

  IF v_in_use THEN
    PERFORM public.pp_raise('catalog_in_use');
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS carriers_delete_guard ON public.carriers;
CREATE TRIGGER carriers_delete_guard
  BEFORE DELETE ON public.carriers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_catalog_delete_guard();

DROP TRIGGER IF EXISTS insurance_products_delete_guard ON public.insurance_products;
CREATE TRIGGER insurance_products_delete_guard
  BEFORE DELETE ON public.insurance_products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_catalog_delete_guard();

-- ---------------------------------------------------------------------------
-- policy_applications: protected columns + RPC context requirement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_policy_application_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Coalesced to '' so that an absent context compares as false rather than
  -- NULL: `NOT (NULL = ANY (...))` is NULL, which would silently skip the guard.
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_write_contexts text[] := ARRAY[
    'create_policy_application',
    'update_policy_application',
    'transition_policy_application_stage',
    'set_policy_application_number',
    'correct_policy_application_number',
    'soft_delete_policy_application'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Applications are soft-deleted only.
    PERFORM public.pp_raise('delete_not_allowed');
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_ctx IS DISTINCT FROM 'create_policy_application' THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (v_ctx = ANY (v_write_contexts)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  -- Immutable for the lifetime of the row.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF (NEW.production_stage IS DISTINCT FROM OLD.production_stage
      OR NEW.underwriting_disposition IS DISTINCT FROM OLD.underwriting_disposition
      OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      OR NEW.in_force_date IS DISTINCT FROM OLD.in_force_date
      OR NEW.decision_date IS DISTINCT FROM OLD.decision_date)
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_stage' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  -- Delivery progress is tracked between issue and in force, so
  -- update_policy_application may advance it; the in_force gate itself still
  -- lives in the transition RPC.
  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_stage'
     AND v_ctx IS DISTINCT FROM 'update_policy_application' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF (NEW.application_number IS DISTINCT FROM OLD.application_number
      OR NEW.application_number_normalized IS DISTINCT FROM OLD.application_number_normalized)
     AND v_ctx IS DISTINCT FROM 'set_policy_application_number'
     AND v_ctx IS DISTINCT FROM 'correct_policy_application_number' THEN
    PERFORM public.pp_raise('identifier_locked');
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND v_ctx IS DISTINCT FROM 'soft_delete_policy_application' THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;

  IF (NEW.policy_number IS DISTINCT FROM OLD.policy_number
      OR NEW.policy_number_normalized IS DISTINCT FROM OLD.policy_number_normalized)
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_stage'
     AND v_ctx IS DISTINCT FROM 'update_policy_application' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF (NEW.carrier_id IS DISTINCT FROM OLD.carrier_id
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.product_line IS DISTINCT FROM OLD.product_line)
     AND v_ctx IS DISTINCT FROM 'update_policy_application' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_applications_protect_columns ON public.policy_applications;
CREATE TRIGGER policy_applications_protect_columns
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_policy_application_protected_columns();

-- ---------------------------------------------------------------------------
-- policy_applications: same-household + catalog consistency.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pp_application_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF NEW.opportunity_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = NEW.opportunity_id
        AND o.deleted_at IS NULL
        AND o.household_id = NEW.household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.insurance_products ip
    WHERE ip.id = NEW.product_id
      AND ip.carrier_id = NEW.carrier_id
      AND ip.product_line = NEW.product_line
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_applications_consistency ON public.policy_applications;
CREATE TRIGGER policy_applications_consistency
  BEFORE INSERT OR UPDATE ON public.policy_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_application_consistency();

-- ---------------------------------------------------------------------------
-- stage history: append only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pp_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Unconditional: history rows are never rewritten, not even by admin SQL.
    PERFORM public.pp_raise('not_authorized');
    RETURN NEW;
  END IF;

  -- DELETE: clients never delete history. Cascades from households /
  -- policy_applications (auth.uid() IS NULL) remain possible for admin cleanup.
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS policy_application_stage_history_append_only
  ON public.policy_application_stage_history;
CREATE TRIGGER policy_application_stage_history_append_only
  BEFORE UPDATE OR DELETE ON public.policy_application_stage_history
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_history_append_only();

CREATE OR REPLACE FUNCTION public.enforce_pp_history_insert_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Coalesced to '' so that an absent context compares as false rather than
  -- NULL: `NOT (NULL = ANY (...))` is NULL, which would silently skip the guard.
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_ctx IS DISTINCT FROM 'create_policy_application'
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_stage' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_application_stage_history_insert_context
  ON public.policy_application_stage_history;
CREATE TRIGGER policy_application_stage_history_insert_context
  BEFORE INSERT ON public.policy_application_stage_history
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_history_insert_context();

-- ---------------------------------------------------------------------------
-- allocations: historical financial fields are immutable. The only sanctioned
-- UPDATE is closing effective_to (NULL -> value) plus its closure reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pp_allocation_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Coalesced to '' so that an absent context compares as false rather than
  -- NULL: `NOT (NULL = ANY (...))` is NULL, which would silently skip the guard.
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

DROP TRIGGER IF EXISTS policy_agent_allocations_immutability ON public.policy_agent_allocations;
CREATE TRIGGER policy_agent_allocations_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_agent_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_allocation_immutability();

-- ---------------------------------------------------------------------------
-- participants: same immutability discipline, plus same-household enforcement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pp_participant_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Coalesced to '' so that an absent context compares as false rather than
  -- NULL: `NOT (NULL = ANY (...))` is NULL, which would silently skip the guard.
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_close_contexts text[] := ARRAY[
    'set_policy_application_participants',
    'transition_policy_application_stage'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Household consistency is enforced regardless of caller identity.
    IF NOT EXISTS (
      SELECT 1
      FROM public.policy_applications a
      JOIN public.household_members hm ON hm.id = NEW.household_member_id
      WHERE a.id = NEW.application_id
        AND hm.deleted_at IS NULL
        AND hm.household_id = a.household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
  END IF;

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
       AND v_ctx IS DISTINCT FROM 'set_policy_application_participants' THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (v_ctx = ANY (v_close_contexts)) THEN
    PERFORM public.pp_raise('participant_change_denied');
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.application_id IS DISTINCT FROM OLD.application_id
     OR NEW.household_member_id IS DISTINCT FROM OLD.household_member_id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    PERFORM public.pp_raise('participant_change_denied');
  END IF;

  IF OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL THEN
    PERFORM public.pp_raise('participant_change_denied');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_application_participants_immutability
  ON public.policy_application_participants;
CREATE TRIGGER policy_application_participants_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_application_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_participant_immutability();

-- ---------------------------------------------------------------------------
-- policies: protect production-linked rows. Deliberately narrow — unlinked
-- policies keep their existing authenticated INSERT/UPDATE behaviour so this
-- migration does not break pre-existing policy management.
--
-- Unlike the other guards here, the source_application_id immutability check
-- runs before the auth.uid() gate: service-role maintenance may create the
-- first link (fixtures, backfills) but may never move or clear an existing one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_policies_pp_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Coalesced to '' so that an absent context compares as false rather than
  -- NULL: `NOT (NULL = ANY (...))` is NULL, which would silently skip the guard.
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_is_issue_ctx boolean := (v_ctx = 'transition_policy_application_stage');
BEGIN
  -- Absolute rule, enforced for every caller including service_role and
  -- migration SQL: once a policy carries a source_application_id it can never
  -- be re-pointed or unlinked. Combined with the unconditional uniqueness of
  -- policies_source_application_unique_idx, an application has exactly one
  -- policy for the lifetime of the database.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.source_application_id IS NOT NULL
       AND NEW.source_application_id IS DISTINCT FROM OLD.source_application_id THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  END IF;

  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Never, not even inside the issue context: issuance only inserts.
    IF OLD.source_application_id IS NOT NULL THEN
      PERFORM public.pp_raise('delete_not_allowed');
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source_application_id IS NULL THEN
      RETURN NEW;
    END IF;
    IF NOT v_is_issue_ctx THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = NEW.source_application_id
        AND a.household_id = NEW.household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
    -- Belt and braces alongside policies_source_application_unique_idx, and
    -- deliberately without a deleted_at filter so it matches that index.
    IF EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.source_application_id = NEW.source_application_id
        AND p.id <> NEW.id
    ) THEN
      PERFORM public.pp_raise('duplicate_link');
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.source_application_id IS NULL AND NEW.source_application_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A linked policy is production history: authenticated writes can never
  -- soft-delete it, and the issue context has no reason to.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;

  IF (NEW.household_id IS DISTINCT FROM OLD.household_id
      OR NEW.carrier IS DISTINCT FROM OLD.carrier
      OR NEW.policy_number IS DISTINCT FROM OLD.policy_number
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.source_application_id IS DISTINCT FROM OLD.source_application_id)
     AND NOT v_is_issue_ctx THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF NEW.source_application_id IS NOT NULL
     AND NEW.source_application_id IS DISTINCT FROM OLD.source_application_id THEN
    IF EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.source_application_id = NEW.source_application_id
        AND p.id <> NEW.id
    ) THEN
      PERFORM public.pp_raise('duplicate_link');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policies_pp_link_guard ON public.policies;
CREATE TRIGGER policies_pp_link_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_policies_pp_link_guard();

REVOKE ALL ON FUNCTION public.enforce_pp_catalog_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_policy_application_protected_columns()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_application_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_history_append_only() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_history_insert_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_allocation_immutability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_participant_immutability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_policies_pp_link_guard() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION I — Internal write helpers used by the RPCs
-- =============================================================================

-- Applies a complete participant set: closes the current rows, then inserts the
-- replacement rows. Closing first keeps the singleton partial unique indexes
-- satisfiable without deferrable constraints.
CREATE OR REPLACE FUNCTION public.pp_apply_participants(
  p_application_id uuid,
  p_participants jsonb,
  p_reason text,
  p_actor_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_allowed_keys text[] := ARRAY['household_member_id', 'role'];
  v_el jsonb;
  v_member uuid;
  v_role public.policy_participant_role;
  v_now timestamptz := now();
  v_count integer := 0;
  v_signatures text[] := ARRAY[]::text[];
  v_signature text;
  v_singleton_seen text[] := ARRAY[]::text[];
BEGIN
  IF p_participants IS NULL OR jsonb_typeof(p_participants) <> 'array' THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;
  IF jsonb_array_length(p_participants) > 20 THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;

  UPDATE public.policy_application_participants
  SET effective_to = v_now,
      change_reason = COALESCE(p_reason, change_reason)
  WHERE application_id = p_application_id
    AND effective_to IS NULL;

  FOR v_el IN SELECT value FROM jsonb_array_elements(p_participants)
  LOOP
    IF jsonb_typeof(v_el) <> 'object' THEN
      PERFORM public.pp_raise('invalid_participants');
    END IF;
    PERFORM public.pp_assert_object_keys(v_el, v_allowed_keys, 'invalid_participants');

    v_member := public.pp_json_uuid(v_el, 'household_member_id', 'invalid_participants');
    v_role := public.pp_parse_participant_role(public.pp_json_text(v_el, 'role'));
    IF v_member IS NULL OR v_role IS NULL THEN
      PERFORM public.pp_raise('invalid_participants');
    END IF;

    v_signature := v_member::text || '|' || v_role::text;
    IF v_signature = ANY (v_signatures) THEN
      PERFORM public.pp_raise('invalid_participants');
    END IF;
    v_signatures := array_append(v_signatures, v_signature);

    -- P1 singletons: one primary_client, one insured, one owner, one annuitant.
    IF v_role IN ('primary_client', 'insured', 'owner', 'annuitant') THEN
      IF v_role::text = ANY (v_singleton_seen) THEN
        PERFORM public.pp_raise('invalid_participants');
      END IF;
      v_singleton_seen := array_append(v_singleton_seen, v_role::text);
    END IF;

    INSERT INTO public.policy_application_participants (
      application_id, household_member_id, role,
      effective_from, change_reason, created_by_user_id
    ) VALUES (
      p_application_id, v_member, v_role,
      v_now, p_reason, p_actor_user_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Applies a complete allocation set. The caller has already run
-- pp_assert_allocations_valid and the house-row authorization check.
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

    IF v_advisor IS NOT NULL THEN
      PERFORM public.pp_assert_advisor_usable(v_advisor);
    END IF;

    INSERT INTO public.policy_agent_allocations (
      application_id, recipient_type, advisor_id, allocation_role,
      commission_bps, production_credit_bps, contract_level_snapshot,
      points_share_scaled, effective_from, change_reason, created_by_user_id
    ) VALUES (
      p_application_id,
      v_recipient,
      v_advisor,
      v_role,
      public.pp_json_int(v_el, 'commission_bps', 'invalid_allocations'),
      public.pp_json_int(v_el, 'production_credit_bps', 'invalid_allocations'),
      public.pp_json_text(v_el, 'contract_level_snapshot'),
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

-- House allocations are an owner-only economic decision at every stage.
CREATE OR REPLACE FUNCTION public.pp_assert_house_rows_authorized(p_allocations jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' THEN
    RETURN;
  END IF;
  IF public.crm_is_owner() THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_allocations) e
    WHERE lower(COALESCE(e ->> 'recipient_type', '')) = 'house'
  ) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_application_snapshot(p_application_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'household_id', a.household_id,
    'opportunity_id', a.opportunity_id,
    'carrier_id', a.carrier_id,
    'product_id', a.product_id,
    'product_line', a.product_line::text,
    'state', a.state,
    'application_number', a.application_number,
    'policy_number', a.policy_number,
    'policy_number_normalized', a.policy_number_normalized,
    'is_replacement', a.is_replacement,
    'is_exchange_or_transfer', a.is_exchange_or_transfer,
    'face_amount_cents', a.face_amount_cents,
    'annuity_deposit_cents', a.annuity_deposit_cents,
    'premium_mode', a.premium_mode,
    'submitted_premium_cents', a.submitted_premium_cents,
    'target_premium_cents', a.target_premium_cents,
    'total_points_scaled', a.total_points_scaled,
    'production_stage', a.production_stage::text,
    'underwriting_disposition', a.underwriting_disposition::text,
    'delivery_status', a.delivery_status::text,
    'submission_date', a.submission_date,
    'decision_date', a.decision_date,
    'issue_date', a.issue_date,
    'in_force_date', a.in_force_date,
    'next_follow_up_date', a.next_follow_up_date,
    'production_month', a.production_month,
    'notes', a.notes,
    'created_by_user_id', a.created_by_user_id,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'deleted_at', a.deleted_at
  )
  FROM public.policy_applications a
  WHERE a.id = p_application_id;
$$;

REVOKE ALL ON FUNCTION public.pp_apply_participants(uuid, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_apply_allocations(uuid, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_house_rows_authorized(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_application_snapshot(uuid) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION J — Catalog RPCs (1-4)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_carrier(p_code text, p_name text)
RETURNS public.carriers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_code text := NULLIF(btrim(COALESCE(p_code, '')), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_code_norm text;
  v_name_norm text;
  v_row public.carriers;
BEGIN
  PERFORM public.pp_assert_owner();

  IF v_code IS NULL OR v_name IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF char_length(v_code) > 40 OR char_length(v_name) > 200 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_code_norm := public.pp_normalize_carrier_code(v_code);
  v_name_norm := public.pp_normalize_text(v_name);
  IF v_code_norm IS NULL OR v_name_norm IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- Catalog collisions surface as invalid_payload: the submitted identifiers
  -- are not usable because an active carrier already owns them.
  IF EXISTS (
    SELECT 1 FROM public.carriers c
    WHERE c.deleted_at IS NULL
      AND (c.code_normalized = v_code_norm OR c.name_normalized = v_name_norm)
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  INSERT INTO public.carriers (code, name, code_normalized, name_normalized)
  VALUES (v_code, v_name, v_code_norm, v_name_norm)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.create_carrier(text, text) IS
  'Owner-only carrier creation. Normalized code and name must be unique among non-deleted carriers.';

CREATE OR REPLACE FUNCTION public.update_carrier(
  p_id uuid,
  p_name text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS public.carriers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_existing public.carriers;
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_name_norm text;
  v_row public.carriers;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing FROM public.carriers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF v_name IS NULL AND p_is_active IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  IF v_name IS NOT NULL THEN
    IF char_length(v_name) > 200 THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    v_name_norm := public.pp_normalize_text(v_name);
    IF v_name_norm IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.carriers c
      WHERE c.deleted_at IS NULL
        AND c.id <> p_id
        AND c.name_normalized = v_name_norm
    ) THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  UPDATE public.carriers
  SET name = COALESCE(v_name, name),
      name_normalized = COALESCE(v_name_norm, name_normalized),
      is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.update_carrier(uuid, text, boolean) IS
  'Owner-only carrier rename / activation toggle. There is no hard delete: deactivate instead.';

CREATE OR REPLACE FUNCTION public.create_insurance_product(
  p_carrier_id uuid,
  p_name text,
  p_product_line text
)
RETURNS public.insurance_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_carrier public.carriers;
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_name_norm text;
  v_line public.insurance_product_line;
  v_row public.insurance_products;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_carrier_id IS NULL OR v_name IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF char_length(v_name) > 200 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_line := public.pp_parse_product_line(p_product_line);
  IF v_line IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  SELECT * INTO v_carrier FROM public.carriers WHERE id = p_carrier_id;
  IF NOT FOUND OR v_carrier.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  -- Products may only be added under an active carrier.
  IF NOT v_carrier.is_active THEN
    PERFORM public.pp_raise('catalog_inactive');
  END IF;

  v_name_norm := public.pp_normalize_text(v_name);
  IF v_name_norm IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.insurance_products ip
    WHERE ip.deleted_at IS NULL
      AND ip.carrier_id = p_carrier_id
      AND ip.name_normalized = v_name_norm
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  INSERT INTO public.insurance_products (carrier_id, name, name_normalized, product_line)
  VALUES (p_carrier_id, v_name, v_name_norm, v_line)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.create_insurance_product(uuid, text, text) IS
  'Owner-only product creation under an active carrier. product_line is immutable once set.';

CREATE OR REPLACE FUNCTION public.update_insurance_product(
  p_id uuid,
  p_name text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS public.insurance_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_existing public.insurance_products;
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_name_norm text;
  v_row public.insurance_products;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing FROM public.insurance_products WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF v_name IS NULL AND p_is_active IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  IF v_name IS NOT NULL THEN
    IF char_length(v_name) > 200 THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    v_name_norm := public.pp_normalize_text(v_name);
    IF v_name_norm IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.insurance_products ip
      WHERE ip.deleted_at IS NULL
        AND ip.id <> p_id
        AND ip.carrier_id = v_existing.carrier_id
        AND ip.name_normalized = v_name_norm
    ) THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  UPDATE public.insurance_products
  SET name = COALESCE(v_name, name),
      name_normalized = COALESCE(v_name_norm, name_normalized),
      is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.update_insurance_product(uuid, text, boolean) IS
  'Owner-only product rename / activation toggle. No hard delete.';

-- =============================================================================
-- SECTION K — create_policy_application (5)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_policy_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed_keys text[] := ARRAY[
    'household_id',
    'opportunity_id',
    'carrier_id',
    'product_id',
    'product_line',
    'state',
    'application_number',
    'is_replacement',
    'is_exchange_or_transfer',
    'face_amount_cents',
    'annuity_deposit_cents',
    'premium_mode',
    'submitted_premium_cents',
    'target_premium_cents',
    'total_points_scaled',
    'submission_date',
    'next_follow_up_date',
    'production_month',
    'notes',
    'participants',
    'allocations'
  ];
  v_household_id uuid;
  v_opportunity_id uuid;
  v_carrier_id uuid;
  v_product_id uuid;
  v_product_line public.insurance_product_line;
  v_state text;
  v_app_number text;
  v_app_number_norm text;
  v_premium_mode text;
  v_notes text;
  v_production_month date;
  v_participants jsonb;
  v_allocations jsonb;
  v_application_id uuid;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_authenticated();
  PERFORM public.pp_assert_payload_size(p_payload);
  PERFORM public.pp_assert_object_keys(p_payload, v_allowed_keys);

  v_household_id := public.pp_json_uuid(p_payload, 'household_id');
  IF v_household_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = v_household_id
      AND h.deleted_at IS NULL
      AND h.merged_into_household_id IS NULL
  ) THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF NOT (public.crm_is_owner() OR public.crm_can_access_household(v_household_id)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  v_carrier_id := public.pp_json_uuid(p_payload, 'carrier_id');
  v_product_id := public.pp_json_uuid(p_payload, 'product_id');
  v_product_line := public.pp_resolve_catalog(
    v_carrier_id,
    v_product_id,
    public.pp_parse_product_line(public.pp_json_text(p_payload, 'product_line'))
  );

  v_state := upper(COALESCE(public.pp_json_text(p_payload, 'state'), ''));
  IF v_state !~ '^[A-Z]{2}$' THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  v_opportunity_id := public.pp_json_uuid(p_payload, 'opportunity_id');
  IF v_opportunity_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = v_opportunity_id
        AND o.deleted_at IS NULL
        AND o.household_id = v_household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
  END IF;

  v_premium_mode := lower(COALESCE(public.pp_json_text(p_payload, 'premium_mode'), ''));
  v_premium_mode := NULLIF(v_premium_mode, '');
  IF NOT public.pp_premium_mode_is_valid(v_premium_mode) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_app_number := public.pp_json_text(p_payload, 'application_number');
  IF v_app_number IS NOT NULL THEN
    IF char_length(v_app_number) > 60 THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    v_app_number_norm := public.pp_normalize_text(v_app_number);
    IF v_app_number_norm IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.deleted_at IS NULL
        AND a.carrier_id = v_carrier_id
        AND a.application_number_normalized = v_app_number_norm
    ) THEN
      PERFORM public.pp_raise('duplicate_application_number');
    END IF;
  END IF;

  v_notes := public.pp_json_text(p_payload, 'notes');
  IF v_notes IS NOT NULL AND char_length(v_notes) > 5000 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_production_month := public.pp_json_date(p_payload, 'production_month');
  IF v_production_month IS NOT NULL THEN
    v_production_month := (date_trunc('month', v_production_month::timestamp))::date;
  END IF;

  v_participants := COALESCE(p_payload -> 'participants', '[]'::jsonb);
  IF jsonb_typeof(v_participants) <> 'array' THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;

  v_allocations := COALESCE(p_payload -> 'allocations', '[]'::jsonb);
  IF jsonb_typeof(v_allocations) <> 'array' THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;
  IF jsonb_array_length(v_allocations) > 0 THEN
    PERFORM public.pp_assert_allocations_valid(v_allocations);
    PERFORM public.pp_assert_house_rows_authorized(v_allocations);
  END IF;

  -- Keep money shape consistent with product line at create time.
  IF v_product_line = 'fia' THEN
    IF public.pp_json_bigint(p_payload, 'face_amount_cents') IS NOT NULL
       OR public.pp_json_bigint(p_payload, 'target_premium_cents') IS NOT NULL THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
  ELSIF public.pp_json_bigint(p_payload, 'annuity_deposit_cents') IS NOT NULL THEN
    PERFORM public.pp_raise('invalid_premium');
  END IF;

  PERFORM set_config('crm.rpc_context', 'create_policy_application', true);
  BEGIN
    INSERT INTO public.policy_applications (
      household_id, opportunity_id, carrier_id, product_id, product_line,
      state, application_number, application_number_normalized,
      is_replacement, is_exchange_or_transfer,
      face_amount_cents, annuity_deposit_cents, premium_mode,
      submitted_premium_cents, target_premium_cents, total_points_scaled,
      production_stage, underwriting_disposition, delivery_status,
      submission_date, next_follow_up_date, production_month, notes,
      created_by_user_id
    ) VALUES (
      v_household_id, v_opportunity_id, v_carrier_id, v_product_id, v_product_line,
      v_state, v_app_number, v_app_number_norm,
      COALESCE(public.pp_json_bool(p_payload, 'is_replacement', false), false),
      COALESCE(public.pp_json_bool(p_payload, 'is_exchange_or_transfer', false), false),
      public.pp_json_bigint(p_payload, 'face_amount_cents'),
      public.pp_json_bigint(p_payload, 'annuity_deposit_cents'),
      v_premium_mode,
      public.pp_json_bigint(p_payload, 'submitted_premium_cents'),
      public.pp_json_bigint(p_payload, 'target_premium_cents'),
      public.pp_json_int(p_payload, 'total_points_scaled'),
      'draft', 'pending', 'pre_issue',
      public.pp_json_date(p_payload, 'submission_date'),
      public.pp_json_date(p_payload, 'next_follow_up_date'),
      v_production_month,
      v_notes,
      v_uid
    ) RETURNING id INTO v_application_id;

    IF jsonb_array_length(v_participants) > 0 THEN
      PERFORM public.pp_apply_participants(v_application_id, v_participants, NULL, v_uid);
    END IF;

    IF jsonb_array_length(v_allocations) > 0 THEN
      PERFORM public.pp_apply_allocations(v_application_id, v_allocations, NULL, v_uid);
    END IF;

    -- Opening history entry: NULL -> draft.
    INSERT INTO public.policy_application_stage_history (
      application_id, from_stage, to_stage,
      from_disposition, to_disposition,
      from_delivery_status, to_delivery_status,
      reason, changed_by_user_id
    ) VALUES (
      v_application_id, NULL, 'draft',
      NULL, 'pending',
      NULL, 'pre_issue',
      'created', v_uid
    );

    v_result := jsonb_build_object(
      'ok', true,
      'created', true,
      'application_id', v_application_id,
      'application', public.pp_application_snapshot(v_application_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.create_policy_application(jsonb) IS
  'Creates a draft policy application with optional participants/allocations and the opening NULL->draft history row. Catalog must be active.';

-- =============================================================================
-- SECTION L — update_policy_application (6)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_policy_application(p_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.policy_applications;
  v_forbidden text[] := ARRAY[
    'id',
    'household_id',
    'production_stage',
    'underwriting_disposition',
    'application_number',
    'application_number_normalized',
    'policy_number_normalized',
    'issue_date',
    'in_force_date',
    'decision_date',
    'deleted_at',
    'created_by_user_id',
    'created_at',
    'updated_at'
  ];
  v_allowed text[];
  v_carrier_id uuid;
  v_product_id uuid;
  v_product_line public.insurance_product_line;
  v_state text;
  v_opportunity_id uuid;
  v_premium_mode text;
  v_notes text;
  v_policy_number text;
  v_policy_number_norm text;
  v_delivery public.policy_delivery_status;
  v_constraint text;
  v_production_month date;
  v_face bigint;
  v_deposit bigint;
  v_submitted bigint;
  v_target bigint;
  v_points integer;
  v_submission_date date;
  v_follow_up date;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_id);
  PERFORM public.pp_assert_payload_size(p_payload);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) AS k WHERE k = ANY (v_forbidden)
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- Editable surface narrows as the application advances.
  v_allowed := CASE
    WHEN v_app.production_stage IN ('draft', 'pre_submitted') THEN ARRAY[
      'carrier_id', 'product_id', 'product_line', 'state', 'opportunity_id',
      'is_replacement', 'is_exchange_or_transfer',
      'face_amount_cents', 'annuity_deposit_cents', 'premium_mode',
      'submitted_premium_cents', 'target_premium_cents',
      'total_points_scaled', 'submission_date', 'next_follow_up_date',
      'production_month', 'notes'
    ]
    WHEN v_app.production_stage IN ('submitted', 'in_underwriting', 'postponed') THEN ARRAY[
      'policy_number', 'is_replacement', 'is_exchange_or_transfer',
      'face_amount_cents', 'annuity_deposit_cents', 'premium_mode',
      'submitted_premium_cents', 'target_premium_cents',
      'total_points_scaled', 'submission_date', 'next_follow_up_date',
      'production_month', 'notes'
    ]
    WHEN v_app.production_stage = 'approved' THEN ARRAY[
      'policy_number',
      'face_amount_cents', 'annuity_deposit_cents', 'premium_mode',
      'submitted_premium_cents', 'target_premium_cents',
      'total_points_scaled', 'next_follow_up_date', 'production_month', 'notes'
    ]
    -- Delivery is worked between issue and in force, so 'issued' may edit it.
    -- 'not_required' is deliberately NOT editable here: waiving delivery is a
    -- reasoned decision recorded by the in_force transition.
    WHEN v_app.production_stage = 'issued' THEN ARRAY[
      'delivery_status',
      'total_points_scaled', 'next_follow_up_date', 'production_month', 'notes'
    ]
    WHEN v_app.production_stage = 'in_force' THEN ARRAY[
      'total_points_scaled', 'next_follow_up_date', 'production_month', 'notes'
    ]
    ELSE ARRAY['notes', 'next_follow_up_date']
  END;

  PERFORM public.pp_assert_object_keys(p_payload, v_allowed);

  v_carrier_id := CASE WHEN p_payload ? 'carrier_id'
    THEN public.pp_json_uuid(p_payload, 'carrier_id') ELSE v_app.carrier_id END;
  v_product_id := CASE WHEN p_payload ? 'product_id'
    THEN public.pp_json_uuid(p_payload, 'product_id') ELSE v_app.product_id END;
  IF v_carrier_id IS NULL OR v_product_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  IF v_carrier_id IS DISTINCT FROM v_app.carrier_id
     OR v_product_id IS DISTINCT FROM v_app.product_id
     OR (p_payload ? 'product_line') THEN
    v_product_line := public.pp_resolve_catalog(
      v_carrier_id,
      v_product_id,
      public.pp_parse_product_line(public.pp_json_text(p_payload, 'product_line'))
    );
  ELSE
    v_product_line := v_app.product_line;
  END IF;

  IF p_payload ? 'state' THEN
    v_state := upper(COALESCE(public.pp_json_text(p_payload, 'state'), ''));
    IF v_state !~ '^[A-Z]{2}$' THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  ELSE
    v_state := v_app.state;
  END IF;

  IF p_payload ? 'opportunity_id' THEN
    v_opportunity_id := public.pp_json_uuid(p_payload, 'opportunity_id');
    IF v_opportunity_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = v_opportunity_id
        AND o.deleted_at IS NULL
        AND o.household_id = v_app.household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
  ELSE
    v_opportunity_id := v_app.opportunity_id;
  END IF;

  IF p_payload ? 'premium_mode' THEN
    v_premium_mode := NULLIF(lower(COALESCE(public.pp_json_text(p_payload, 'premium_mode'), '')), '');
    IF NOT public.pp_premium_mode_is_valid(v_premium_mode) THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  ELSE
    v_premium_mode := v_app.premium_mode;
  END IF;

  IF p_payload ? 'policy_number' THEN
    v_policy_number := public.pp_json_text(p_payload, 'policy_number');
    IF v_policy_number IS NOT NULL THEN
      IF char_length(v_policy_number) > 60 THEN
        PERFORM public.pp_raise('invalid_payload');
      END IF;
      v_policy_number_norm := public.pp_normalize_text(v_policy_number);
      IF v_policy_number_norm IS NULL THEN
        PERFORM public.pp_raise('invalid_payload');
      END IF;
      -- Case-insensitive, and unfiltered by deleted_at to match
      -- policy_applications_carrier_policy_number_unique_idx.
      IF EXISTS (
        SELECT 1 FROM public.policy_applications a
        WHERE a.id <> p_id
          AND a.carrier_id = v_carrier_id
          AND a.policy_number_normalized = v_policy_number_norm
      ) THEN
        PERFORM public.pp_raise('duplicate_policy_number');
      END IF;
    END IF;
  ELSE
    v_policy_number := v_app.policy_number;
    v_policy_number_norm := v_app.policy_number_normalized;
  END IF;

  IF p_payload ? 'delivery_status' THEN
    v_delivery := public.pp_parse_delivery_status(
      public.pp_json_text(p_payload, 'delivery_status')
    );
    -- Delivery progress only. 'pre_issue' is behind us and 'not_required' is
    -- owned by the in_force transition, which demands a reason for it.
    IF v_delivery IS NULL OR v_delivery NOT IN (
      'not_started', 'with_agent', 'with_client', 'requirements_pending', 'complete'
    ) THEN
      PERFORM public.pp_raise('invalid_delivery_status');
    END IF;
    PERFORM public.pp_assert_delivery_status_allowed(v_app.production_stage, v_delivery);
  ELSE
    v_delivery := v_app.delivery_status;
  END IF;

  IF p_payload ? 'notes' THEN
    v_notes := public.pp_json_text(p_payload, 'notes');
    IF v_notes IS NOT NULL AND char_length(v_notes) > 5000 THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  ELSE
    v_notes := v_app.notes;
  END IF;

  IF p_payload ? 'production_month' THEN
    v_production_month := public.pp_json_date(p_payload, 'production_month');
    IF v_production_month IS NOT NULL THEN
      v_production_month := (date_trunc('month', v_production_month::timestamp))::date;
    END IF;
  ELSE
    v_production_month := v_app.production_month;
  END IF;

  v_face := CASE WHEN p_payload ? 'face_amount_cents'
    THEN public.pp_json_bigint(p_payload, 'face_amount_cents') ELSE v_app.face_amount_cents END;
  v_deposit := CASE WHEN p_payload ? 'annuity_deposit_cents'
    THEN public.pp_json_bigint(p_payload, 'annuity_deposit_cents') ELSE v_app.annuity_deposit_cents END;
  v_submitted := CASE WHEN p_payload ? 'submitted_premium_cents'
    THEN public.pp_json_bigint(p_payload, 'submitted_premium_cents') ELSE v_app.submitted_premium_cents END;
  v_target := CASE WHEN p_payload ? 'target_premium_cents'
    THEN public.pp_json_bigint(p_payload, 'target_premium_cents') ELSE v_app.target_premium_cents END;
  v_points := CASE WHEN p_payload ? 'total_points_scaled'
    THEN public.pp_json_int(p_payload, 'total_points_scaled') ELSE v_app.total_points_scaled END;
  v_submission_date := CASE WHEN p_payload ? 'submission_date'
    THEN public.pp_json_date(p_payload, 'submission_date') ELSE v_app.submission_date END;
  v_follow_up := CASE WHEN p_payload ? 'next_follow_up_date'
    THEN public.pp_json_date(p_payload, 'next_follow_up_date') ELSE v_app.next_follow_up_date END;

  IF (v_face IS NOT NULL AND v_face < 0)
     OR (v_deposit IS NOT NULL AND v_deposit < 0)
     OR (v_submitted IS NOT NULL AND v_submitted < 0)
     OR (v_target IS NOT NULL AND v_target < 0)
     OR (v_points IS NOT NULL AND v_points < 0) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF v_submission_date IS NOT NULL AND v_app.issue_date IS NOT NULL
     AND v_app.issue_date < v_submission_date THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- Keep the product line and the money shape consistent after any change.
  IF v_product_line = 'fia' THEN
    IF v_face IS NOT NULL OR v_target IS NOT NULL THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
  ELSIF v_deposit IS NOT NULL THEN
    PERFORM public.pp_raise('invalid_premium');
  END IF;

  PERFORM set_config('crm.rpc_context', 'update_policy_application', true);
  BEGIN
    UPDATE public.policy_applications
    SET carrier_id = v_carrier_id,
        product_id = v_product_id,
        product_line = v_product_line,
        state = v_state,
        opportunity_id = v_opportunity_id,
        is_replacement = COALESCE(
          public.pp_json_bool(p_payload, 'is_replacement', v_app.is_replacement),
          v_app.is_replacement
        ),
        is_exchange_or_transfer = COALESCE(
          public.pp_json_bool(p_payload, 'is_exchange_or_transfer', v_app.is_exchange_or_transfer),
          v_app.is_exchange_or_transfer
        ),
        face_amount_cents = v_face,
        annuity_deposit_cents = v_deposit,
        premium_mode = v_premium_mode,
        submitted_premium_cents = v_submitted,
        target_premium_cents = v_target,
        total_points_scaled = v_points,
        policy_number = v_policy_number,
        policy_number_normalized = v_policy_number_norm,
        delivery_status = v_delivery,
        submission_date = v_submission_date,
        next_follow_up_date = v_follow_up,
        production_month = v_production_month,
        notes = v_notes
    WHERE id = p_id;

    v_result := jsonb_build_object(
      'ok', true,
      'updated', true,
      'application_id', p_id,
      'application', public.pp_application_snapshot(p_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION
    WHEN unique_violation THEN
      -- A concurrent writer won the race the precheck above tried to catch.
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      PERFORM public.crm_clear_rpc_context();
      IF v_constraint = 'policy_applications_carrier_policy_number_unique_idx' THEN
        PERFORM public.pp_raise('duplicate_policy_number');
      END IF;
      RAISE;
    WHEN OTHERS THEN
      PERFORM public.crm_clear_rpc_context();
      RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.update_policy_application(uuid, jsonb) IS
  'Stage-aware field edits. Stage, disposition, application number, issue linkage and soft delete are rejected here and owned by their dedicated RPCs. delivery_status is editable only at stage issued and only among not_started / with_agent / with_client / requirements_pending / complete: not_required is reserved for the in_force transition, which requires a reason.';

-- =============================================================================
-- SECTION M — set_policy_application_participants (7)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_policy_application_participants(
  p_application_id uuid,
  p_participants jsonb,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean := public.crm_is_owner();
  v_app public.policy_applications;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_count integer;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  -- Post-issue the participant set is part of the issued contract.
  IF v_app.production_stage IN ('issued', 'in_force') THEN
    PERFORM public.pp_raise('participant_change_denied');
  END IF;

  IF v_app.production_stage NOT IN ('draft', 'pre_submitted') THEN
    -- After submission only the owner may restructure roles, and only on record.
    IF NOT v_is_owner THEN
      PERFORM public.pp_raise('participant_change_denied');
    END IF;
    IF v_reason IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
  END IF;

  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF p_participants IS NULL OR jsonb_typeof(p_participants) <> 'array' THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;

  PERFORM set_config('crm.rpc_context', 'set_policy_application_participants', true);
  BEGIN
    v_count := public.pp_apply_participants(p_application_id, p_participants, v_reason, v_uid);

    -- Once submitted the role set must remain complete for the product line.
    IF v_app.production_stage NOT IN ('draft', 'pre_submitted') THEN
      PERFORM public.pp_assert_participants_for_submit(p_application_id, v_app.product_line);
    END IF;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'participant_count', v_count
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.set_policy_application_participants(uuid, jsonb, text) IS
  'Supersedes the whole current participant set. Pre-submit: owner or assigned advisor. Post-submit: owner plus reason. Post-issue: rejected.';

-- =============================================================================
-- SECTION N — set_policy_application_allocations (8)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_policy_application_allocations(
  p_application_id uuid,
  p_allocations jsonb,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean := public.crm_is_owner();
  v_app public.policy_applications;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_count integer;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  PERFORM public.pp_assert_allocations_valid(p_allocations);
  -- House economics are owner-only at every stage.
  PERFORM public.pp_assert_house_rows_authorized(p_allocations);

  IF v_app.production_stage NOT IN ('draft', 'pre_submitted') THEN
    IF NOT v_is_owner THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    IF v_reason IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
  END IF;

  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  PERFORM set_config('crm.rpc_context', 'set_policy_application_allocations', true);
  BEGIN
    v_count := public.pp_apply_allocations(p_application_id, p_allocations, v_reason, v_uid);

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'allocation_count', v_count,
      'allocations', public.pp_current_allocations_json(p_application_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.set_policy_application_allocations(uuid, jsonb, text) IS
  'Supersedes the whole current allocation set. Writing rows sum to 10000 bps on commission and production credit independently; servicing rows are zeroed. House rows are owner-only; post-submit changes are owner-only plus reason.';

-- =============================================================================
-- SECTION O — transition_policy_application_stage (9)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transition_policy_application_stage(
  p_application_id uuid,
  p_to_stage text,
  p_disposition text DEFAULT NULL,
  p_delivery_status text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_fields jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean := public.crm_is_owner();
  v_app public.policy_applications;
  v_to public.policy_application_stage;
  v_from public.policy_application_stage;
  v_disp public.policy_underwriting_disposition;
  v_delivery public.policy_delivery_status;
  v_requested_delivery public.policy_delivery_status;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_allowed_keys text[];
  v_fields jsonb := COALESCE(p_fields, '{}'::jsonb);
  v_submission_date date;
  v_decision_date date;
  v_issue_date date;
  v_in_force_date date;
  v_follow_up date;
  v_production_month date;
  v_policy_number text;
  v_policy_number_norm text;
  v_carrier_name text;
  v_product_name text;
  v_policy_type text;
  v_insured_member uuid;
  v_owner_member uuid;
  v_annuitant_member uuid;
  v_servicing_advisor uuid;
  v_policy_id uuid;
  v_linked_policy_id uuid;
  v_constraint text;
  v_coverage numeric(14, 2);
  v_premium numeric(14, 2);
  v_details jsonb;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_application_id);

  v_to := public.pp_parse_stage(p_to_stage);
  IF v_to IS NULL THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  v_from := v_app.production_stage;

  -- policies.source_application_id is the only link, so the policy this
  -- application already produced (if any) is resolved by query.
  SELECT p.id INTO v_linked_policy_id
  FROM public.policies p
  WHERE p.source_application_id = p_application_id
    AND p.deleted_at IS NULL
  LIMIT 1;

  PERFORM public.pp_assert_transition_allowed(v_from, v_to, v_is_owner);

  -- Backward moves are exceptional and must always be justified.
  IF public.pp_is_backward_transition(v_from, v_to) AND v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 1000 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- ---- disposition -------------------------------------------------------
  v_disp := public.pp_parse_disposition(p_disposition);
  IF v_disp IS NULL THEN
    v_disp := CASE
      WHEN v_to IN ('draft', 'pre_submitted', 'submitted', 'in_underwriting') THEN 'pending'
      WHEN v_to = 'declined' THEN 'declined'
      WHEN v_to = 'postponed' THEN 'postponed'
      WHEN v_to IN ('approved', 'issued', 'in_force') THEN
        CASE
          WHEN v_app.underwriting_disposition IN (
            'approved_as_applied',
            'approved_other_than_applied',
            'approved_with_amendment'
          ) THEN v_app.underwriting_disposition
          ELSE 'approved_as_applied'
        END
      ELSE v_app.underwriting_disposition
    END;
  END IF;
  PERFORM public.pp_validate_stage_disposition(v_to, v_disp);

  -- ---- delivery status ---------------------------------------------------
  -- Defaults: pre_issue before issue, not_started at issue. 'not_required' is
  -- only ever reached by passing it explicitly; it is never a default.
  v_requested_delivery := public.pp_parse_delivery_status(p_delivery_status);
  IF v_requested_delivery IS NOT NULL THEN
    v_delivery := v_requested_delivery;
  ELSIF v_to = 'issued' THEN
    v_delivery := 'not_started';
  ELSIF v_to = 'in_force' THEN
    -- No coercion here: whatever delivery state the application is actually in
    -- has to satisfy the in_force gate below on its own.
    v_delivery := v_app.delivery_status;
  ELSE
    v_delivery := CASE
      WHEN v_app.delivery_status = 'not_required' THEN 'not_required'
      ELSE 'pre_issue'
    END;
  END IF;

  IF v_to = 'in_force' THEN
    PERFORM public.pp_assert_in_force_delivery(
      v_app.product_line, v_delivery, v_is_owner, v_reason
    );
  END IF;
  PERFORM public.pp_assert_delivery_status_allowed(v_to, v_delivery);

  -- ---- p_fields ----------------------------------------------------------
  IF jsonb_typeof(v_fields) <> 'object' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  v_allowed_keys := CASE v_to
    WHEN 'pre_submitted' THEN ARRAY['next_follow_up_date']
    WHEN 'submitted' THEN ARRAY['submission_date', 'next_follow_up_date']
    WHEN 'in_underwriting' THEN ARRAY['next_follow_up_date']
    WHEN 'approved' THEN ARRAY[
      'decision_date', 'policy_number', 'target_premium_cents', 'next_follow_up_date'
    ]
    WHEN 'declined' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'postponed' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'withdrawn' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'incomplete' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'not_taken' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'issued' THEN ARRAY[
      'issue_date', 'policy_number', 'production_month', 'next_follow_up_date'
    ]
    WHEN 'in_force' THEN ARRAY[
      'in_force_date', 'production_month', 'next_follow_up_date'
    ]
    ELSE ARRAY[]::text[]
  END;
  PERFORM public.pp_assert_object_keys(v_fields, v_allowed_keys);

  v_submission_date := COALESCE(public.pp_json_date(v_fields, 'submission_date'), v_app.submission_date);
  v_decision_date := COALESCE(public.pp_json_date(v_fields, 'decision_date'), v_app.decision_date);
  v_issue_date := COALESCE(public.pp_json_date(v_fields, 'issue_date'), v_app.issue_date);
  v_in_force_date := COALESCE(public.pp_json_date(v_fields, 'in_force_date'), v_app.in_force_date);
  v_follow_up := CASE WHEN v_fields ? 'next_follow_up_date'
    THEN public.pp_json_date(v_fields, 'next_follow_up_date') ELSE v_app.next_follow_up_date END;
  v_production_month := CASE WHEN v_fields ? 'production_month'
    THEN (date_trunc('month', public.pp_json_date(v_fields, 'production_month')::timestamp))::date
    ELSE v_app.production_month END;
  v_policy_number := COALESCE(public.pp_json_text(v_fields, 'policy_number'), v_app.policy_number);
  IF v_policy_number IS NOT NULL AND char_length(v_policy_number) > 60 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_policy_number IS NOT NULL THEN
    v_policy_number_norm := public.pp_normalize_text(v_policy_number);
    IF v_policy_number_norm IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    -- Case-insensitive carrier-scoped uniqueness, matching
    -- policy_applications_carrier_policy_number_unique_idx.
    IF v_policy_number_norm IS DISTINCT FROM v_app.policy_number_normalized
       AND EXISTS (
         SELECT 1 FROM public.policy_applications a
         WHERE a.id <> p_application_id
           AND a.carrier_id = v_app.carrier_id
           AND a.policy_number_normalized = v_policy_number_norm
       ) THEN
      PERFORM public.pp_raise('duplicate_policy_number');
    END IF;
  END IF;

  -- Stage-driven date defaults.
  IF v_to = 'submitted' AND v_submission_date IS NULL THEN
    v_submission_date := current_date;
  END IF;
  IF v_to IN ('approved', 'declined', 'postponed', 'withdrawn', 'incomplete', 'not_taken')
     AND v_decision_date IS NULL THEN
    v_decision_date := current_date;
  END IF;
  -- Milestone defaults never fall before the milestone they follow, so a
  -- future-dated submission or issue cannot produce an impossible sequence.
  IF v_to = 'issued' AND v_issue_date IS NULL THEN
    v_issue_date := GREATEST(current_date, COALESCE(v_submission_date, current_date));
  END IF;
  IF v_to = 'in_force' AND v_in_force_date IS NULL THEN
    v_in_force_date := GREATEST(current_date, COALESCE(v_issue_date, current_date));
  END IF;

  -- Surface out-of-order milestone dates as the CRM_PP contract rather than
  -- letting the table CHECK constraints leak a raw 23514.
  IF v_issue_date IS NOT NULL AND v_submission_date IS NOT NULL
     AND v_issue_date < v_submission_date THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_in_force_date IS NOT NULL AND v_issue_date IS NOT NULL
     AND v_in_force_date < v_issue_date THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- ---- submit gates ------------------------------------------------------
  IF v_to = 'submitted' AND v_from IN ('draft', 'pre_submitted') THEN
    PERFORM public.pp_assert_participants_for_submit(p_application_id, v_app.product_line);
    PERFORM public.pp_assert_premium_for_submit(
      v_app.product_line,
      v_app.face_amount_cents,
      v_app.annuity_deposit_cents,
      v_app.submitted_premium_cents,
      v_app.premium_mode
    );
    PERFORM public.pp_assert_allocations_valid(public.pp_current_allocations_json(p_application_id));
  END IF;

  IF v_to = 'issued' THEN
    IF v_policy_number IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
    -- Unfiltered by deleted_at: the link is permanent, so an application that
    -- ever produced a policy can never produce another one.
    IF EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.source_application_id = p_application_id
    ) THEN
      PERFORM public.pp_raise('duplicate_link');
    END IF;
    PERFORM public.pp_assert_participants_for_submit(p_application_id, v_app.product_line);
    PERFORM public.pp_assert_premium_for_submit(
      v_app.product_line,
      v_app.face_amount_cents,
      v_app.annuity_deposit_cents,
      v_app.submitted_premium_cents,
      v_app.premium_mode
    );
  END IF;

  IF v_to = 'in_force' AND v_linked_policy_id IS NULL THEN
    PERFORM public.pp_raise('issue_failed');
  END IF;

  PERFORM set_config('crm.rpc_context', 'transition_policy_application_stage', true);
  BEGIN
    IF v_to = 'issued' THEN
      SELECT c.name INTO v_carrier_name FROM public.carriers c WHERE c.id = v_app.carrier_id;
      SELECT ip.name INTO v_product_name
      FROM public.insurance_products ip WHERE ip.id = v_app.product_id;
      IF v_carrier_name IS NULL THEN
        PERFORM public.pp_raise('issue_failed');
      END IF;
      v_policy_type := COALESCE(NULLIF(btrim(COALESCE(v_product_name, '')), ''), v_app.product_line::text);

      SELECT pa.household_member_id INTO v_insured_member
      FROM public.policy_application_participants pa
      WHERE pa.application_id = p_application_id
        AND pa.effective_to IS NULL
        AND pa.role = 'insured'
      LIMIT 1;

      SELECT pa.household_member_id INTO v_owner_member
      FROM public.policy_application_participants pa
      WHERE pa.application_id = p_application_id
        AND pa.effective_to IS NULL
        AND pa.role = 'owner'
      LIMIT 1;

      SELECT pa.household_member_id INTO v_annuitant_member
      FROM public.policy_application_participants pa
      WHERE pa.application_id = p_application_id
        AND pa.effective_to IS NULL
        AND pa.role = 'annuitant'
      LIMIT 1;

      -- Servicing advisor: the explicit servicing row wins, otherwise the
      -- writing advisor holding the largest production credit share.
      SELECT al.advisor_id INTO v_servicing_advisor
      FROM public.policy_agent_allocations al
      WHERE al.application_id = p_application_id
        AND al.effective_to IS NULL
        AND al.advisor_id IS NOT NULL
      ORDER BY (al.allocation_role = 'servicing') DESC, al.production_credit_bps DESC, al.advisor_id
      LIMIT 1;

      IF v_app.product_line = 'fia' THEN
        -- FIA: no coverage amount and no premium. The deposit never touches
        -- policies.premium; it is carried in details for reporting.
        v_coverage := NULL;
        v_premium := NULL;
        v_details := jsonb_build_object(
          'source', 'policy_production',
          'product_line', v_app.product_line::text,
          'product_id', v_app.product_id,
          'carrier_id', v_app.carrier_id,
          'annuity_deposit_cents', v_app.annuity_deposit_cents,
          'annuitant_member_id', v_annuitant_member,
          'application_id', p_application_id
        );
      ELSE
        v_coverage := (v_app.face_amount_cents::numeric / 100.0);
        v_premium := (v_app.submitted_premium_cents::numeric / 100.0);
        v_details := jsonb_build_object(
          'source', 'policy_production',
          'product_line', v_app.product_line::text,
          'product_id', v_app.product_id,
          'carrier_id', v_app.carrier_id,
          'premium_mode', v_app.premium_mode,
          'target_premium_cents', v_app.target_premium_cents,
          'application_id', p_application_id
        );
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.policies p
        WHERE p.deleted_at IS NULL
          AND p.carrier = v_carrier_name
          AND p.policy_number = v_policy_number
      ) THEN
        PERFORM public.pp_raise('duplicate_policy_number');
      END IF;

      INSERT INTO public.policies (
        household_id, insured_member_id, policy_owner_member_id, opportunity_id,
        servicing_advisor_id, carrier, policy_type, policy_number,
        coverage_amount, premium, payment_frequency, effective_date,
        status, details, source_application_id
      ) VALUES (
        v_app.household_id,
        CASE WHEN v_app.product_line = 'fia' THEN NULL ELSE v_insured_member END,
        v_owner_member,
        v_app.opportunity_id,
        v_servicing_advisor,
        v_carrier_name,
        v_policy_type,
        v_policy_number,
        v_coverage,
        v_premium,
        CASE WHEN v_app.product_line = 'fia'
          THEN NULL
          ELSE public.pp_payment_frequency_from_mode(v_app.premium_mode) END,
        v_issue_date,
        'issued',
        jsonb_strip_nulls(v_details),
        p_application_id
      ) RETURNING id INTO v_policy_id;

      IF v_policy_id IS NULL THEN
        PERFORM public.pp_raise('issue_failed');
      END IF;
    END IF;

    IF v_to = 'in_force' THEN
      UPDATE public.policies
      SET status = 'in_force',
          effective_date = COALESCE(effective_date, v_in_force_date)
      WHERE source_application_id = p_application_id
        AND deleted_at IS NULL;
      IF NOT FOUND THEN
        PERFORM public.pp_raise('issue_failed');
      END IF;
    END IF;

    UPDATE public.policy_applications
    SET production_stage = v_to,
        underwriting_disposition = v_disp,
        delivery_status = v_delivery,
        submission_date = v_submission_date,
        decision_date = v_decision_date,
        issue_date = v_issue_date,
        in_force_date = v_in_force_date,
        next_follow_up_date = v_follow_up,
        production_month = v_production_month,
        policy_number = v_policy_number,
        policy_number_normalized = v_policy_number_norm,
        target_premium_cents = COALESCE(
          public.pp_json_bigint(v_fields, 'target_premium_cents'),
          target_premium_cents
        )
    WHERE id = p_application_id;

    INSERT INTO public.policy_application_stage_history (
      application_id, from_stage, to_stage,
      from_disposition, to_disposition,
      from_delivery_status, to_delivery_status,
      reason, changed_by_user_id
    ) VALUES (
      p_application_id, v_from, v_to,
      v_app.underwriting_disposition, v_disp,
      v_app.delivery_status, v_delivery,
      v_reason, v_uid
    );

    -- Read the link back rather than trusting a mirror column.
    SELECT p.id INTO v_policy_id
    FROM public.policies p
    WHERE p.source_application_id = p_application_id
      AND p.deleted_at IS NULL
    LIMIT 1;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'from_stage', v_from::text,
      'to_stage', v_to::text,
      'underwriting_disposition', v_disp::text,
      'delivery_status', v_delivery::text,
      'policy_id', v_policy_id,
      'application', public.pp_application_snapshot(p_application_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION
    WHEN unique_violation THEN
      -- The issue path races two unique indexes; translate both rather than
      -- leaking a raw 23505 to the client.
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      PERFORM public.crm_clear_rpc_context();
      IF v_constraint = 'policies_source_application_unique_idx' THEN
        PERFORM public.pp_raise('duplicate_link');
      ELSIF v_constraint IN (
        'policy_applications_carrier_policy_number_unique_idx',
        'policies_carrier_number_unique_idx'
      ) THEN
        PERFORM public.pp_raise('duplicate_policy_number');
      END IF;
      RAISE;
    WHEN OTHERS THEN
      PERFORM public.crm_clear_rpc_context();
      RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.transition_policy_application_stage(uuid, text, text, text, text, jsonb) IS
  'Single entry point for the production state machine. Creates the linked policy atomically on issued (policies.source_application_id = application id, the only link between the tables) and flips that policy to in_force. Going in force requires a settled delivery outcome: complete, or not_required with a reason (owner-only on life business). Backward moves are limited to in_underwriting->submitted, postponed->in_underwriting and approved->in_underwriting (owner only) and always require a reason.';

-- =============================================================================
-- SECTION P — Application number RPCs (10, 11)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_policy_application_number(
  p_application_id uuid,
  p_application_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_app public.policy_applications;
  v_number text := NULLIF(btrim(COALESCE(p_application_number, '')), '');
  v_norm text;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF v_number IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF char_length(v_number) > 60 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- Carriers only issue an application number once the paperwork is in.
  IF v_app.production_stage IN ('draft', 'pre_submitted') THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- One-way assignment: NULL -> value. Replacement is a correction, not a set.
  IF v_app.application_number IS NOT NULL THEN
    PERFORM public.pp_raise('identifier_locked');
  END IF;

  v_norm := public.pp_normalize_text(v_number);
  IF v_norm IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.policy_applications a
    WHERE a.deleted_at IS NULL
      AND a.id <> p_application_id
      AND a.carrier_id = v_app.carrier_id
      AND a.application_number_normalized = v_norm
  ) THEN
    PERFORM public.pp_raise('duplicate_application_number');
  END IF;

  PERFORM set_config('crm.rpc_context', 'set_policy_application_number', true);
  BEGIN
    UPDATE public.policy_applications
    SET application_number = v_number,
        application_number_normalized = v_norm
    WHERE id = p_application_id;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'application_number', v_number
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.set_policy_application_number(uuid, text) IS
  'One-way NULL->value assignment after submission, for the owner or an advisor with household access. Unique per carrier among non-deleted applications.';

CREATE OR REPLACE FUNCTION public.correct_policy_application_number(
  p_application_id uuid,
  p_application_number text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_app public.policy_applications;
  v_number text := NULLIF(btrim(COALESCE(p_application_number, '')), '');
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_norm text;
  v_audit_id uuid;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_owner();
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF v_number IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) > 500 THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF char_length(v_number) > 60 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- Corrections only apply to an already-assigned identifier.
  IF v_app.application_number IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_norm := public.pp_normalize_text(v_number);
  IF v_norm IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.policy_applications a
    WHERE a.deleted_at IS NULL
      AND a.id <> p_application_id
      AND a.carrier_id = v_app.carrier_id
      AND a.application_number_normalized = v_norm
  ) THEN
    PERFORM public.pp_raise('duplicate_application_number');
  END IF;

  -- The correction and its audit row are written in one block, so the single
  -- EXCEPTION handler below rolls back both: an application number is never
  -- rewritten without the matching audit_logs entry, and the audit entry never
  -- survives a failed correction.
  PERFORM set_config('crm.rpc_context', 'correct_policy_application_number', true);
  BEGIN
    UPDATE public.policy_applications
    SET application_number = v_number,
        application_number_normalized = v_norm
    WHERE id = p_application_id;

    v_audit_id := public.crm_write_audit(
      'correct_policy_application_number',
      'policy_applications',
      p_application_id,
      jsonb_build_object(
        'application_number', v_app.application_number,
        'application_number_normalized', v_app.application_number_normalized
      ),
      jsonb_build_object(
        'application_number', v_number,
        'application_number_normalized', v_norm,
        'reason', v_reason
      )
    );
    IF v_audit_id IS NULL THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'application_number', v_number,
      'previous_application_number', v_app.application_number
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.correct_policy_application_number(uuid, text, text) IS
  'Owner-only correction of an already-set application number. Requires a reason and writes exactly one public.audit_logs entry via crm_write_audit, in the same transaction block as the UPDATE so the two succeed or fail together. audit_logs is the append-oriented security log: owners can SELECT it, authenticated holds no INSERT / UPDATE / DELETE grant, and no Activities row or user-facing timeline event is produced for a correction.';

-- =============================================================================
-- SECTION Q — soft_delete_policy_application (12)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_policy_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_app public.policy_applications;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_owner();
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  -- Anything that reached a carrier is production history and must be closed
  -- through the state machine (withdrawn / incomplete), never deleted.
  IF v_app.production_stage NOT IN ('draft', 'pre_submitted') THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.source_application_id = p_application_id
  ) THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;

  PERFORM set_config('crm.rpc_context', 'soft_delete_policy_application', true);
  BEGIN
    UPDATE public.policy_applications
    SET deleted_at = now()
    WHERE id = p_application_id;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'deleted', true
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_policy_application(uuid) IS
  'Owner-only soft delete, restricted to draft / pre_submitted applications with no issued policy.';

-- =============================================================================
-- SECTION R — RLS
--
-- SELECT-only policies. There are deliberately NO INSERT / UPDATE / DELETE
-- policies on any new table: the SECURITY DEFINER RPCs are the only write path.
-- Satellite visibility is expressed as an inline EXISTS against
-- policy_applications so that no helper needs EXECUTE for authenticated.
-- =============================================================================

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carriers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policy_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_stage_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policy_agent_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_agent_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carriers_select ON public.carriers;
CREATE POLICY carriers_select ON public.carriers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR (public.crm_is_advisor() AND is_active = true)
    )
  );

DROP POLICY IF EXISTS insurance_products_select ON public.insurance_products;
CREATE POLICY insurance_products_select ON public.insurance_products
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR (
        public.crm_is_advisor()
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.carriers c
          WHERE c.id = insurance_products.carrier_id
            AND c.deleted_at IS NULL
            AND c.is_active = true
        )
      )
    )
  );

DROP POLICY IF EXISTS policy_applications_select ON public.policy_applications;
CREATE POLICY policy_applications_select ON public.policy_applications
  FOR SELECT TO authenticated
  USING (
    public.crm_is_owner()
    OR (deleted_at IS NULL AND public.crm_can_access_household(household_id))
  );

DROP POLICY IF EXISTS policy_application_participants_select
  ON public.policy_application_participants;
CREATE POLICY policy_application_participants_select
  ON public.policy_application_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = policy_application_participants.application_id
        AND (
          public.crm_is_owner()
          OR (a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))
        )
    )
  );

DROP POLICY IF EXISTS policy_application_stage_history_select
  ON public.policy_application_stage_history;
CREATE POLICY policy_application_stage_history_select
  ON public.policy_application_stage_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = policy_application_stage_history.application_id
        AND (
          public.crm_is_owner()
          OR (a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))
        )
    )
  );

DROP POLICY IF EXISTS policy_agent_allocations_select ON public.policy_agent_allocations;
CREATE POLICY policy_agent_allocations_select ON public.policy_agent_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = policy_agent_allocations.application_id
        AND (
          public.crm_is_owner()
          OR (a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))
        )
    )
  );

-- =============================================================================
-- SECTION S — Table grants
--
-- Supabase default privileges grant ALL on new public tables to anon /
-- authenticated, so the REVOKEs here are load-bearing, not cosmetic.
-- public.policies keeps its existing authenticated DML: production-linked rows
-- are protected by enforce_policies_pp_link_guard instead.
-- =============================================================================

REVOKE ALL ON TABLE
  public.carriers,
  public.insurance_products,
  public.policy_applications,
  public.policy_application_participants,
  public.policy_application_stage_history,
  public.policy_agent_allocations
FROM PUBLIC;

REVOKE ALL ON TABLE
  public.carriers,
  public.insurance_products,
  public.policy_applications,
  public.policy_application_participants,
  public.policy_application_stage_history,
  public.policy_agent_allocations
FROM anon;

REVOKE ALL ON TABLE
  public.carriers,
  public.insurance_products,
  public.policy_applications,
  public.policy_application_participants,
  public.policy_application_stage_history,
  public.policy_agent_allocations
FROM authenticated;

GRANT SELECT ON TABLE
  public.carriers,
  public.insurance_products,
  public.policy_applications,
  public.policy_application_participants,
  public.policy_application_stage_history,
  public.policy_agent_allocations
TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.carriers,
  public.insurance_products,
  public.policy_applications,
  public.policy_application_participants,
  public.policy_application_stage_history,
  public.policy_agent_allocations
FROM authenticated;

GRANT ALL ON TABLE
  public.carriers,
  public.insurance_products,
  public.policy_applications,
  public.policy_application_participants,
  public.policy_application_stage_history,
  public.policy_agent_allocations
TO service_role;

-- =============================================================================
-- SECTION T — RPC grants (authenticated only)
-- =============================================================================

REVOKE ALL ON FUNCTION public.create_carrier(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_carrier(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_carrier(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_carrier(uuid, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.create_insurance_product(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_insurance_product(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_insurance_product(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_insurance_product(uuid, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.create_policy_application(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_policy_application(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.update_policy_application(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_policy_application(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.set_policy_application_participants(uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_policy_application_participants(uuid, jsonb, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.set_policy_application_allocations(uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_policy_application_allocations(uuid, jsonb, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.transition_policy_application_stage(
  uuid, text, text, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_policy_application_stage(
  uuid, text, text, text, text, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.set_policy_application_number(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_policy_application_number(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.correct_policy_application_number(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_policy_application_number(uuid, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.soft_delete_policy_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_policy_application(uuid) TO authenticated;

-- =============================================================================
-- SECTION U — P1 scope documentation
-- =============================================================================

COMMENT ON TYPE public.policy_participant_role IS
  'Application role vocabulary. P1 permits at most one current annuitant per application (FIA single-annuitant limitation) and at most one current insured (survivorship / multi-insured life cases are deferred). joint_owner and payor may repeat concurrently.';

COMMENT ON INDEX public.policy_application_participants_singleton_role_idx IS
  'P1 limitation: exactly one current primary_client / insured / owner / annuitant. Joint annuitant FIA contracts and survivorship / multi-insured life cases are deferred to a later phase, which will replace this index rather than widen it in place.';

COMMENT ON TYPE public.insurance_product_line IS
  'life_term and life_permanent map onto policies.coverage_amount + policies.premium; fia maps onto policies.details.annuity_deposit_cents with coverage_amount and premium left NULL. policies.premium is never used to carry an FIA deposit.';

COMMENT ON COLUMN public.policies.premium IS
  'Modal life premium in currency units. NEVER used for FIA/annuity deposits: policy production stores those in policy_applications.annuity_deposit_cents and mirrors them into policies.details.';

COMMENT ON TYPE public.policy_application_stage IS
  'Production state machine. Forward transitions only, except in_underwriting->submitted, postponed->in_underwriting and approved->in_underwriting (owner only). declined, withdrawn, incomplete, not_taken and in_force have no outgoing transitions: there is no in_force->issued, no issued->approved, and no reopening a terminal application.';

COMMENT ON TYPE public.policy_delivery_status IS
  'Delivery tracking. pre_issue is the placeholder before issue; not_started / with_agent / with_client / requirements_pending are in-flight and may be edited by update_policy_application while the application sits at issued. in_force accepts only the settled outcomes complete and not_required, and not_required is never a default: it must be passed explicitly to the in_force transition with a reason, and on life_term / life_permanent only the owner may choose it.';

-- =============================================================================
-- End Migration 032
-- =============================================================================
