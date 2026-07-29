-- 019_assessment_lifecycle_status.sql
-- Draft/completed lifecycle for public.assessments (Household Onboarding foundation).
-- Existing rows are treated as completed. Drafts require completed_at IS NULL.

-- ---------------------------------------------------------------------------
-- Lifecycle enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.assessment_status AS ENUM (
    'draft',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.assessment_status IS
  'Assessment lifecycle. draft = in-progress CRM capture; completed = finalized snapshot.';

-- ---------------------------------------------------------------------------
-- status column (existing rows → completed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS status public.assessment_status NOT NULL DEFAULT 'completed';

COMMENT ON COLUMN public.assessments.status IS
  'Lifecycle status. Existing historical rows default to completed. Drafts are CRM onboarding only in v1.';

-- ---------------------------------------------------------------------------
-- Allow null completed_at for drafts; keep default for completed inserts
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessments
  ALTER COLUMN completed_at DROP NOT NULL;

ALTER TABLE public.assessments
  ALTER COLUMN completed_at SET DEFAULT now();

-- Deterministic backfill: any row still missing status semantics is completed.
-- (ADD COLUMN DEFAULT already set status; ensure completed rows have timestamps.)
UPDATE public.assessments
SET
  status = 'completed',
  completed_at = COALESCE(completed_at, created_at, now())
WHERE status = 'completed'
  AND completed_at IS NULL;

UPDATE public.assessments
SET completed_at = NULL
WHERE status = 'draft';

-- ---------------------------------------------------------------------------
-- Enforce status ↔ completed_at pairing
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_status_completed_at_check;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_status_completed_at_check
  CHECK (
    (status = 'draft' AND completed_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- One active Household Onboarding draft per household
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS assessments_one_active_onboarding_draft_per_household_idx
  ON public.assessments (household_id)
  WHERE assessment_type = 'household_onboarding'
    AND status = 'draft'
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS assessments_household_onboarding_draft_idx
  ON public.assessments (household_id, updated_at DESC)
  WHERE assessment_type = 'household_onboarding'
    AND status = 'draft'
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS assessments_household_onboarding_completed_idx
  ON public.assessments (household_id, completed_at DESC)
  WHERE assessment_type = 'household_onboarding'
    AND status = 'completed'
    AND deleted_at IS NULL;

COMMENT ON TABLE public.assessments IS
  'Durable assessment history. answers/priorities/metrics stored as JSONB. status distinguishes draft vs completed; Financial Progress scores are not stored here for onboarding drafts.';
