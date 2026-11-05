-- Reviewed deployment candidate for the development Academy pilot.
BEGIN;

CREATE TABLE public.academy_pilot_progress (
  advisor_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed text[] NOT NULL DEFAULT '{}',
  last_lesson text NOT NULL
);

ALTER TABLE public.academy_pilot_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.academy_pilot_progress FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.academy_pilot_progress(p_lesson text DEFAULT NULL, p_choice integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  progress public.academy_pilot_progress%ROWTYPE;
  core text[] := ARRAY['core-valtoris', 'core-referrals', 'core-marketing', 'core-networking'];
  expected integer;
  correct boolean;
BEGIN
  IF actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = actor AND is_active AND deleted_at IS NULL AND role IN ('owner', 'advisor')
  ) THEN
    RAISE EXCEPTION 'Academy access denied' USING ERRCODE = '42501';
  END IF;

  IF p_lesson IS NULL THEN
    IF p_choice IS NOT NULL THEN
      RAISE EXCEPTION 'A lesson is required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO progress FROM public.academy_pilot_progress WHERE advisor_id = actor;
  ELSE
    expected := CASE p_lesson
      WHEN 'core-valtoris' THEN 0
      WHEN 'core-referrals' THEN 1
      WHEN 'core-marketing' THEN 2
      WHEN 'core-networking' THEN 0
      WHEN 'first-conversation' THEN 1
      WHEN 'verify-the-record' THEN 2
      WHEN 'handoff-and-follow-up' THEN 0
    END;
    IF expected IS NULL OR p_choice NOT BETWEEN 0 AND 2 THEN
      RAISE EXCEPTION 'Invalid Academy lesson or answer' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.academy_pilot_progress (advisor_id, last_lesson)
    VALUES (actor, core[1]) ON CONFLICT (advisor_id) DO NOTHING;
    SELECT * INTO progress FROM public.academy_pilot_progress WHERE advisor_id = actor FOR UPDATE;

    IF NOT (p_lesson = ANY(core)) AND NOT (progress.completed @> core) THEN
      RAISE EXCEPTION 'Complete Valtoris Core first' USING ERRCODE = '42501';
    END IF;

    correct := p_choice = expected;
    UPDATE public.academy_pilot_progress
    SET last_lesson = p_lesson,
        completed = CASE WHEN correct AND NOT (p_lesson = ANY(completed))
                         THEN array_append(completed, p_lesson) ELSE completed END
    WHERE advisor_id = actor
    RETURNING * INTO progress;
  END IF;

  RETURN jsonb_build_object(
    'completed', coalesce(progress.completed, ARRAY[]::text[]),
    'lastLesson', coalesce(progress.last_lesson, core[1]),
    'correct', correct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.academy_pilot_progress(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_pilot_progress(text, integer) TO authenticated;

COMMIT;
