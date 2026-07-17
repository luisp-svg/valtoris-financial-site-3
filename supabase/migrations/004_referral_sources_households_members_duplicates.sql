-- 004_referral_sources_households_members_duplicates.sql
-- Referral sources, households (master client), members, duplicate review queue.
-- Includes immutable original-attribution enforcement triggers.

-- ---------------------------------------------------------------------------
-- referral_sources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_sources (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL,
  source_type text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_sources_name_unique UNIQUE (name)
);

DROP TRIGGER IF EXISTS referral_sources_set_updated_at ON public.referral_sources;
CREATE TRIGGER referral_sources_set_updated_at
  BEFORE UPDATE ON public.referral_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  display_name text NOT NULL,
  status public.household_status NOT NULL DEFAULT 'lead',

  -- Contact
  primary_email extensions.citext,
  normalized_email extensions.citext,
  primary_phone text,
  normalized_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  preferred_contact_method public.preferred_contact_method,

  -- Immutable attribution (never overwrite once set)
  original_advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  original_advisor_slug text,
  original_referral_source_id uuid REFERENCES public.referral_sources (id) ON DELETE SET NULL,
  original_campaign text,
  original_source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Mutable operational assignment
  assigned_advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assignment_reason public.assignment_reason,

  -- Relationship pipeline
  relationship_pipeline_id uuid NOT NULL REFERENCES public.pipelines (id) ON DELETE RESTRICT,
  relationship_stage_id uuid NOT NULL REFERENCES public.pipeline_stages (id) ON DELETE RESTRICT,
  stage_entered_at timestamptz,

  -- Source / ops
  lead_source text,
  referral_source_id uuid REFERENCES public.referral_sources (id) ON DELETE SET NULL,

  -- Duplicate matching
  potential_duplicate_of uuid REFERENCES public.households (id) ON DELETE SET NULL,
  duplicate_review_status public.duplicate_review_status NOT NULL DEFAULT 'none',
  merged_into_household_id uuid REFERENCES public.households (id) ON DELETE SET NULL,

  external_sheet_row_ref text,
  notes_summary text,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS households_normalized_email_idx
  ON public.households (normalized_email)
  WHERE deleted_at IS NULL AND merged_into_household_id IS NULL AND normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS households_normalized_phone_idx
  ON public.households (normalized_phone)
  WHERE deleted_at IS NULL AND merged_into_household_id IS NULL AND normalized_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS households_assigned_advisor_idx
  ON public.households (assigned_advisor_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS households_unassigned_pool_idx
  ON public.households (created_at DESC)
  WHERE assigned_advisor_id IS NULL AND deleted_at IS NULL AND merged_into_household_id IS NULL;

CREATE INDEX IF NOT EXISTS households_relationship_stage_idx
  ON public.households (relationship_stage_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS households_status_idx
  ON public.households (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS households_duplicate_review_idx
  ON public.households (duplicate_review_status)
  WHERE duplicate_review_status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS households_original_advisor_idx
  ON public.households (original_advisor_id);

DROP TRIGGER IF EXISTS households_set_updated_at ON public.households;
CREATE TRIGGER households_set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.households IS
  'Master client/household. One household, many opportunities across verticals.';
COMMENT ON COLUMN public.households.original_advisor_id IS
  'Immutable lead attribution. Enforced by trigger once non-null.';
COMMENT ON COLUMN public.households.assigned_advisor_id IS
  'Mutable servicing advisor. NULL = unassigned lead pool. Change via assign_household RPC.';
COMMENT ON COLUMN public.households.normalized_email IS
  'lower(trim(email)) for duplicate matching.';
COMMENT ON COLUMN public.households.normalized_phone IS
  'US-first E.164 (+1XXXXXXXXXX) for duplicate matching.';

-- ---------------------------------------------------------------------------
-- Immutable attribution trigger (households)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_immutable_household_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  -- Once set, original attribution fields cannot change.
  IF OLD.original_advisor_id IS NOT NULL AND NEW.original_advisor_id IS DISTINCT FROM OLD.original_advisor_id THEN
    RAISE EXCEPTION 'original_advisor_id is immutable once set';
  END IF;
  IF OLD.original_advisor_slug IS NOT NULL AND NEW.original_advisor_slug IS DISTINCT FROM OLD.original_advisor_slug THEN
    RAISE EXCEPTION 'original_advisor_slug is immutable once set';
  END IF;
  IF OLD.original_referral_source_id IS NOT NULL AND NEW.original_referral_source_id IS DISTINCT FROM OLD.original_referral_source_id THEN
    RAISE EXCEPTION 'original_referral_source_id is immutable once set';
  END IF;
  IF OLD.original_campaign IS NOT NULL AND NEW.original_campaign IS DISTINCT FROM OLD.original_campaign THEN
    RAISE EXCEPTION 'original_campaign is immutable once set';
  END IF;
  -- Allow filling empty original_source_metadata only if old was empty object and we treat "set" as non-empty.
  IF OLD.original_source_metadata IS NOT NULL
     AND OLD.original_source_metadata <> '{}'::jsonb
     AND NEW.original_source_metadata IS DISTINCT FROM OLD.original_source_metadata THEN
    RAISE EXCEPTION 'original_source_metadata is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS households_immutable_attribution ON public.households;
CREATE TRIGGER households_immutable_attribution
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutable_household_attribution();

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  relationship public.member_relationship NOT NULL DEFAULT 'primary',
  is_primary_contact boolean NOT NULL DEFAULT false,
  email extensions.citext,
  normalized_email extensions.citext,
  phone text,
  normalized_phone text,
  date_of_birth date,
  age integer,
  is_business_owner boolean NOT NULL DEFAULT false,
  business_name text,
  business_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS household_members_one_primary_contact_idx
  ON public.household_members (household_id)
  WHERE is_primary_contact = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS household_members_household_idx
  ON public.household_members (household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS household_members_normalized_email_idx
  ON public.household_members (normalized_email)
  WHERE deleted_at IS NULL AND normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS household_members_normalized_phone_idx
  ON public.household_members (normalized_phone)
  WHERE deleted_at IS NULL AND normalized_phone IS NOT NULL;

DROP TRIGGER IF EXISTS household_members_set_updated_at ON public.household_members;
CREATE TRIGGER household_members_set_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.household_members.business_profile IS
  'Flexible business RC fields (entity, industry, revenue) without wide typed columns.';

-- ---------------------------------------------------------------------------
-- duplicate_reviews (manual queue; never auto-merge uncertain matches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duplicate_reviews (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  incoming_lead_id uuid, -- FK added in 005 after leads exist
  candidate_household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  provisional_household_id uuid REFERENCES public.households (id) ON DELETE SET NULL,
  match_reason text NOT NULL,
  match_confidence text NOT NULL CHECK (match_confidence IN ('high', 'medium', 'low')),
  status public.duplicate_review_status NOT NULL DEFAULT 'pending',
  resolution_notes text,
  resolved_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS duplicate_reviews_status_idx
  ON public.duplicate_reviews (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS duplicate_reviews_candidate_idx
  ON public.duplicate_reviews (candidate_household_id);

DROP TRIGGER IF EXISTS duplicate_reviews_set_updated_at ON public.duplicate_reviews;
CREATE TRIGGER duplicate_reviews_set_updated_at
  BEFORE UPDATE ON public.duplicate_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.duplicate_reviews IS
  'Manual duplicate queue. Uncertain matches create provisional households; owner merges later.';
