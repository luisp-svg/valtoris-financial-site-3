-- 006_opportunities_assignments.sql
-- Opportunities + advisor assignment history.
-- Opportunities are created explicitly (e.g. convert_recommendation_to_opportunity), not auto from ingest.

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  service_vertical_id uuid NOT NULL REFERENCES public.service_verticals (id) ON DELETE RESTRICT,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines (id) ON DELETE RESTRICT,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages (id) ON DELETE RESTRICT,
  title text NOT NULL,
  status public.opportunity_status NOT NULL DEFAULT 'open',
  need_identified boolean NOT NULL DEFAULT true,
  next_action text,
  next_action_due_at date,
  source_assessment_id uuid REFERENCES public.assessments (id) ON DELETE SET NULL,
  source_lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  source_recommendation_id uuid REFERENCES public.recommendations (id) ON DELETE SET NULL,

  assigned_advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assignment_reason public.assignment_reason,

  stage_entered_at timestamptz,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS opportunities_household_idx
  ON public.opportunities (household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS opportunities_assigned_status_idx
  ON public.opportunities (assigned_advisor_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS opportunities_vertical_stage_idx
  ON public.opportunities (service_vertical_id, stage_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS opportunities_pipeline_stage_idx
  ON public.opportunities (pipeline_id, stage_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS opportunities_source_recommendation_idx
  ON public.opportunities (source_recommendation_id)
  WHERE source_recommendation_id IS NOT NULL;

DROP TRIGGER IF EXISTS opportunities_set_updated_at ON public.opportunities;
CREATE TRIGGER opportunities_set_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.opportunities IS
  'Service-specific deals. Multiple open opportunities per household across verticals.';
COMMENT ON COLUMN public.opportunities.source_recommendation_id IS
  'Set when created via convert_recommendation_to_opportunity.';

-- FK: recommendations.converted_opportunity_id → opportunities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_converted_opportunity_id_fkey'
  ) THEN
    ALTER TABLE public.recommendations
      ADD CONSTRAINT recommendations_converted_opportunity_id_fkey
      FOREIGN KEY (converted_opportunity_id) REFERENCES public.opportunities (id) ON DELETE SET NULL;
  END IF;
END $$;

-- Service-needs matrix view (opportunities as matrix rows)
CREATE OR REPLACE VIEW public.service_needs_matrix AS
SELECT
  o.id AS opportunity_id,
  o.household_id,
  o.service_vertical_id,
  v.code AS service_code,
  v.name AS service_name,
  o.need_identified,
  o.status,
  o.assigned_advisor_id,
  o.stage_id,
  s.name AS stage_name,
  o.next_action,
  o.next_action_due_at,
  o.updated_at
FROM public.opportunities o
JOIN public.service_verticals v ON v.id = o.service_vertical_id
JOIN public.pipeline_stages s ON s.id = o.stage_id
WHERE o.deleted_at IS NULL;

COMMENT ON VIEW public.service_needs_matrix IS
  'V1 service-needs matrix derived from opportunities (no separate matrix table).';

-- Prevent RLS bypass via view owner privileges (C1).
ALTER VIEW public.service_needs_matrix SET (security_invoker = true);
REVOKE ALL ON public.service_needs_matrix FROM PUBLIC;
REVOKE ALL ON public.service_needs_matrix FROM anon;
GRANT SELECT ON public.service_needs_matrix TO authenticated;

-- ---------------------------------------------------------------------------
-- advisor_assignments (history + current)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advisor_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE CASCADE,
  assignment_role text NOT NULL DEFAULT 'primary'
    CHECK (assignment_role IN ('primary', 'service', 'split')),
  reason public.assignment_reason NOT NULL,
  is_attribution_source boolean NOT NULL DEFAULT false,
  assigned_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advisor_assignments_effective_range CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS advisor_assignments_household_idx
  ON public.advisor_assignments (household_id, effective_to);

CREATE INDEX IF NOT EXISTS advisor_assignments_advisor_idx
  ON public.advisor_assignments (advisor_id, effective_to);

CREATE UNIQUE INDEX IF NOT EXISTS advisor_assignments_one_current_primary_idx
  ON public.advisor_assignments (household_id)
  WHERE opportunity_id IS NULL
    AND effective_to IS NULL
    AND assignment_role = 'primary';

COMMENT ON TABLE public.advisor_assignments IS
  'Assignment history. is_attribution_source marks original credit; effective_to null = current.';
COMMENT ON COLUMN public.advisor_assignments.is_attribution_source IS
  'True for the original attribution row; never cleared when reassigning.';
