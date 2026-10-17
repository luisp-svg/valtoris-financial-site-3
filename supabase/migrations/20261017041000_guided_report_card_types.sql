-- Additive v4 Report Card types. Commit this migration before the writer migration.
-- No historical rows, contacts, grants, or policies are changed.
ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'health';
ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'tsp';
ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'benefits';
ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'tax';
