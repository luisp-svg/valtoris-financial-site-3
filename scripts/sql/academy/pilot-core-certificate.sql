-- Development deployment candidate. Requires the graded Core exam.
BEGIN;

ALTER TABLE public.academy_pilot_core_exam
  ADD COLUMN certificate_id uuid UNIQUE,
  ADD COLUMN certificate_issued_at timestamptz,
  ADD COLUMN certificate_name text,
  ADD CONSTRAINT academy_core_certificate_complete CHECK (
    (certificate_id IS NULL AND certificate_issued_at IS NULL AND certificate_name IS NULL)
    OR (best_correct >= 6 AND certificate_id IS NOT NULL AND certificate_issued_at IS NOT NULL AND certificate_name IS NOT NULL)
  );

-- Existing active advisor passes receive the rollout date, since the pilot did not store attempt dates.
UPDATE public.academy_pilot_core_exam exam
SET certificate_id = gen_random_uuid(),
    certificate_issued_at = statement_timestamp(),
    certificate_name = coalesce(nullif(btrim(p.full_name), ''), 'Valtoris advisor')
FROM public.profiles p
WHERE p.id = exam.advisor_id AND p.role = 'advisor' AND p.is_active AND p.deleted_at IS NULL
  AND exam.best_correct >= 6;

CREATE OR REPLACE FUNCTION public.academy_pilot_core_exam(p_answers integer[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  answer_key constant integer[] := ARRAY[1, 0, 2, 0, 1, 2, 0];
  score integer;
  result public.academy_pilot_core_exam%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = actor AND is_active AND deleted_at IS NULL AND role IN ('advisor', 'owner')
  ) THEN
    RAISE EXCEPTION 'Academy access denied' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.academy_pilot_progress
    WHERE advisor_id = actor
      AND completed @> ARRAY['core-valtoris', 'core-referrals', 'core-marketing', 'core-networking']
  ) THEN
    RAISE EXCEPTION 'Complete Valtoris Core first' USING ERRCODE = '42501';
  END IF;

  IF p_answers IS NULL THEN
    SELECT * INTO result FROM public.academy_pilot_core_exam WHERE advisor_id = actor;
  ELSE
    IF array_ndims(p_answers) IS DISTINCT FROM 1 OR cardinality(p_answers) <> 7
      OR EXISTS (SELECT 1 FROM unnest(p_answers) answer WHERE answer IS NULL OR answer NOT BETWEEN 0 AND 2)
    THEN
      RAISE EXCEPTION 'Answer all seven questions' USING ERRCODE = '22023';
    END IF;
    SELECT count(*)::integer INTO score
    FROM unnest(p_answers) WITH ORDINALITY AS submitted(answer, position)
    WHERE submitted.answer = answer_key[submitted.position];

    INSERT INTO public.academy_pilot_core_exam (advisor_id, best_correct) VALUES (actor, score)
    ON CONFLICT (advisor_id) DO UPDATE SET best_correct = greatest(academy_pilot_core_exam.best_correct, excluded.best_correct)
    RETURNING * INTO result;

    IF result.best_correct >= 6 AND result.certificate_id IS NULL THEN
      UPDATE public.academy_pilot_core_exam exam
      SET certificate_id = gen_random_uuid(),
          certificate_issued_at = statement_timestamp(),
          certificate_name = coalesce(nullif(btrim(p.full_name), ''), 'Valtoris advisor')
      FROM public.profiles p
      WHERE exam.advisor_id = actor AND exam.certificate_id IS NULL AND p.id = actor
        AND p.role = 'advisor' AND p.is_active AND p.deleted_at IS NULL
      RETURNING exam.* INTO result;
      IF NOT FOUND THEN
        SELECT * INTO result FROM public.academy_pilot_core_exam WHERE advisor_id = actor;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'score', score,
    'best', result.best_correct,
    'certificate', CASE WHEN result.certificate_id IS NOT NULL THEN jsonb_build_object(
      'id', result.certificate_id, 'issuedAt', result.certificate_issued_at, 'name', result.certificate_name
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.academy_pilot_core_exam(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_pilot_core_exam(integer[]) TO authenticated;

DROP FUNCTION public.academy_pilot_owner_overview();

CREATE FUNCTION public.academy_pilot_owner_overview()
RETURNS TABLE (
  advisor_id uuid,
  advisor_name text,
  completed text[],
  last_lesson text,
  core_exam_best integer,
  core_certificate_id uuid,
  core_certificate_issued_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active AND deleted_at IS NULL AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Academy owner access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed advisor'),
           coalesce(progress.completed, ARRAY[]::text[]), progress.last_lesson, exam.best_correct,
           exam.certificate_id, exam.certificate_issued_at
    FROM public.profiles p
    LEFT JOIN public.academy_pilot_progress progress ON progress.advisor_id = p.id
    LEFT JOIN public.academy_pilot_core_exam exam ON exam.advisor_id = p.id
    WHERE p.is_active AND p.deleted_at IS NULL AND p.role = 'advisor'
    ORDER BY 2, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.academy_pilot_owner_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_pilot_owner_overview() TO authenticated;

COMMIT;
