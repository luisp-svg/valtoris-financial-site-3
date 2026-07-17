-- 005_leads_assessments_recommendations.sql
-- Leads, assessments, recommendations layer.
-- V1 ingest creates recommendations from findings; does NOT auto-create opportunities.

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  lead_type text NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'new',
  assessment_type public.assessment_type,
  source_page text,
  submitted_at timestamptz NOT NULL DEFAULT now(),

  -- Immutable attribution (lead-level snapshot)
  original_advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  original_advisor_slug text,
  original_referral_source_id uuid REFERENCES public.referral_sources (id) ON DELETE SET NULL,
  original_campaign text,
  original_source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attribution_method public.attribution_method NOT NULL DEFAULT 'unknown',

  -- Mutable assignment
  assigned_advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assignment_reason public.assignment_reason,

  -- Score snapshot at capture
  overall_score numeric(5, 2),
  overall_grade text,
  top_priorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  normalized_email extensions.citext,
  normalized_phone text,
  potential_duplicate_of_household_id uuid REFERENCES public.households (id) ON DELETE SET NULL,
  duplicate_review_status public.duplicate_review_status NOT NULL DEFAULT 'none',
  external_sheet_row_ref text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS leads_household_submitted_idx
  ON public.leads (household_id, submitted_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS leads_assigned_status_idx
  ON public.leads (assigned_advisor_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS leads_unassigned_idx
  ON public.leads (submitted_at DESC)
  WHERE status = 'unassigned' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS leads_normalized_email_idx
  ON public.leads (normalized_email)
  WHERE deleted_at IS NULL AND normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_lead_type_idx
  ON public.leads (lead_type)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Immutable attribution on leads
CREATE OR REPLACE FUNCTION public.enforce_immutable_lead_attribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.original_advisor_id IS NOT NULL AND NEW.original_advisor_id IS DISTINCT FROM OLD.original_advisor_id THEN
    RAISE EXCEPTION 'leads.original_advisor_id is immutable once set';
  END IF;
  IF OLD.original_advisor_slug IS NOT NULL AND NEW.original_advisor_slug IS DISTINCT FROM OLD.original_advisor_slug THEN
    RAISE EXCEPTION 'leads.original_advisor_slug is immutable once set';
  END IF;
  IF OLD.original_referral_source_id IS NOT NULL AND NEW.original_referral_source_id IS DISTINCT FROM OLD.original_referral_source_id THEN
    RAISE EXCEPTION 'leads.original_referral_source_id is immutable once set';
  END IF;
  IF OLD.original_campaign IS NOT NULL AND NEW.original_campaign IS DISTINCT FROM OLD.original_campaign THEN
    RAISE EXCEPTION 'leads.original_campaign is immutable once set';
  END IF;
  IF OLD.original_source_metadata IS NOT NULL
     AND OLD.original_source_metadata <> '{}'::jsonb
     AND NEW.original_source_metadata IS DISTINCT FROM OLD.original_source_metadata THEN
    RAISE EXCEPTION 'leads.original_source_metadata is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_immutable_attribution ON public.leads;
CREATE TRIGGER leads_immutable_attribution
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutable_lead_attribution();

COMMENT ON TABLE public.leads IS
  'Inbound inquiry per submission. Multiple leads per household over time.';
COMMENT ON COLUMN public.leads.raw_payload IS
  'Full master lead payload for audit/replay. Restrict SELECT in app layer.';

-- Backfill FK from duplicate_reviews to leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'duplicate_reviews_incoming_lead_id_fkey'
  ) THEN
    ALTER TABLE public.duplicate_reviews
      ADD CONSTRAINT duplicate_reviews_incoming_lead_id_fkey
      FOREIGN KEY (incoming_lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  assessment_type public.assessment_type NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  overall_score numeric(5, 2),
  overall_grade text,
  priorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  derived_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring_version integer NOT NULL DEFAULT 1,
  report_token text,
  report_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS assessments_household_completed_idx
  ON public.assessments (household_id, completed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS assessments_type_idx
  ON public.assessments (assessment_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS assessments_lead_id_idx
  ON public.assessments (lead_id)
  WHERE lead_id IS NOT NULL;

DROP TRIGGER IF EXISTS assessments_set_updated_at ON public.assessments;
CREATE TRIGGER assessments_set_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.assessments IS
  'Durable scored diagnostic history. answers/priorities/metrics stored as JSONB.';
COMMENT ON COLUMN public.assessments.scoring_version IS
  'Bump when scoring engines change to keep historical comparability.';

-- ---------------------------------------------------------------------------
-- recommendations
-- Assessment → Finding/Recommendation → Advisor Review → Optional Opportunity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments (id) ON DELETE SET NULL,
  service_vertical_id uuid REFERENCES public.service_verticals (id) ON DELETE SET NULL,
  assigned_advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  rationale text,
  priority public.recommendation_priority NOT NULL DEFAULT 'medium',
  status public.recommendation_status NOT NULL DEFAULT 'new',
  recommended_action text,
  target_timeframe text,
  converted_opportunity_id uuid, -- FK added in 006 after opportunities exist
  reviewed_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  advisor_notes text,
  source_rule_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT recommendations_converted_requires_opportunity CHECK (
    status <> 'converted' OR converted_opportunity_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS recommendations_household_idx
  ON public.recommendations (household_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS recommendations_assessment_idx
  ON public.recommendations (assessment_id)
  WHERE assessment_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS recommendations_status_idx
  ON public.recommendations (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS recommendations_assigned_advisor_idx
  ON public.recommendations (assigned_advisor_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS recommendations_vertical_idx
  ON public.recommendations (service_vertical_id)
  WHERE deleted_at IS NULL AND service_vertical_id IS NOT NULL;

DROP TRIGGER IF EXISTS recommendations_set_updated_at ON public.recommendations;
CREATE TRIGGER recommendations_set_updated_at
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.recommendations IS
  'Findings/planning actions before sales opportunities. Conversion is explicit via RPC; never automatic in V1.';
COMMENT ON COLUMN public.recommendations.source_rule_code IS
  'Stable rule id from ingest mapping (e.g. family_priority_life_gap). Null for manual recommendations.';
COMMENT ON COLUMN public.recommendations.metadata IS
  'Extra finding context (category scores, source priority rank) without schema churn.';
COMMENT ON COLUMN public.recommendations.created_by_user_id IS
  'Null for system/ingest-generated; set for advisor-created manual recommendations.';
