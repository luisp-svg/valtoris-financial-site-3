-- 007_tasks_notes_activities.sql
-- Tasks, notes, and user-facing activity timeline.

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_date date,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'open',
  assigned_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS tasks_assignee_queue_idx
  ON public.tasks (assigned_user_id, status, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_household_idx
  ON public.tasks (household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_opportunity_idx
  ON public.tasks (opportunity_id)
  WHERE opportunity_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  body text NOT NULL,
  visibility public.note_visibility NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS notes_household_created_idx
  ON public.notes (household_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_opportunity_idx
  ON public.notes (opportunity_id)
  WHERE opportunity_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS notes_set_updated_at ON public.notes;
CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activities (append-oriented timeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  assessment_id uuid REFERENCES public.assessments (id) ON DELETE SET NULL,
  recommendation_id uuid REFERENCES public.recommendations (id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  activity_type public.activity_type NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS activities_household_occurred_idx
  ON public.activities (household_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activities_opportunity_occurred_idx
  ON public.activities (opportunity_id, occurred_at DESC)
  WHERE opportunity_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activities_type_idx
  ON public.activities (activity_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activities_recommendation_idx
  ON public.activities (recommendation_id)
  WHERE recommendation_id IS NOT NULL;

COMMENT ON TABLE public.activities IS
  'User-facing household timeline. email_sent/sms_sent reserved for future; unused in V1.';
COMMENT ON COLUMN public.activities.metadata IS
  'Structured before/after (stage ids, advisor ids, recommendation conversion details).';
COMMENT ON COLUMN public.activities.actor_user_id IS
  'Null for system/ingest events.';
