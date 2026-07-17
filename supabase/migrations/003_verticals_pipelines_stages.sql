-- 003_verticals_pipelines_stages.sql
-- Data-driven service verticals and pipelines (created before households need FKs).

-- ---------------------------------------------------------------------------
-- service_verticals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_verticals (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_verticals_code_unique UNIQUE (code)
);

DROP TRIGGER IF EXISTS service_verticals_set_updated_at ON public.service_verticals;
CREATE TRIGGER service_verticals_set_updated_at
  BEFORE UPDATE ON public.service_verticals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.service_verticals IS
  'Catalog of service lines. Add future verticals via INSERT — no schema change.';

-- ---------------------------------------------------------------------------
-- pipelines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL,
  pipeline_type public.pipeline_type NOT NULL,
  service_vertical_id uuid REFERENCES public.service_verticals (id) ON DELETE RESTRICT,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipelines_type_vertical_check CHECK (
    (pipeline_type = 'relationship' AND service_vertical_id IS NULL)
    OR (pipeline_type = 'service' AND service_vertical_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pipelines_one_default_relationship_idx
  ON public.pipelines (pipeline_type)
  WHERE pipeline_type = 'relationship' AND is_default = true AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS pipelines_one_default_per_vertical_idx
  ON public.pipelines (service_vertical_id)
  WHERE pipeline_type = 'service' AND is_default = true AND is_active = true AND service_vertical_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pipelines_vertical_idx
  ON public.pipelines (service_vertical_id)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS pipelines_set_updated_at ON public.pipelines;
CREATE TRIGGER pipelines_set_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.pipelines IS
  'Relationship board (one default) or per-vertical service boards.';

-- ---------------------------------------------------------------------------
-- pipeline_stages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  sort_order integer NOT NULL,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  is_terminal boolean NOT NULL DEFAULT false,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_stages_pipeline_code_unique UNIQUE (pipeline_id, code),
  CONSTRAINT pipeline_stages_pipeline_sort_unique UNIQUE (pipeline_id, sort_order)
);

CREATE INDEX IF NOT EXISTS pipeline_stages_pipeline_sort_idx
  ON public.pipeline_stages (pipeline_id, sort_order);

DROP TRIGGER IF EXISTS pipeline_stages_set_updated_at ON public.pipeline_stages;
CREATE TRIGGER pipeline_stages_set_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.pipeline_stages IS
  'Ordered stages. Stable code keys support automation without renaming fragility.';
