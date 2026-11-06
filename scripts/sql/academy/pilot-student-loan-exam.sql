-- Development deployment candidate. Requires the Core certificate setup.
BEGIN;

CREATE TABLE public.academy_pilot_student_loan_exam (
  advisor_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_correct integer NOT NULL CHECK (best_correct BETWEEN 0 AND 7)
);

ALTER TABLE public.academy_pilot_student_loan_exam ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.academy_pilot_student_loan_exam FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.academy_pilot_student_loan_exam(p_answers integer[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  answer_key constant integer[] := ARRAY[0, 0, 2, 0, 1, 2, 2];
  score integer;
  best integer;
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
      AND completed @> ARRAY['core-valtoris', 'core-referrals', 'core-marketing', 'core-networking',
                         'first-conversation', 'verify-the-record', 'handoff-and-follow-up']
  ) THEN
    RAISE EXCEPTION 'Complete Core and the student loan practice checks first' USING ERRCODE = '42501';
  END IF;

  IF p_answers IS NULL THEN
    SELECT best_correct INTO best FROM public.academy_pilot_student_loan_exam WHERE advisor_id = actor;
  ELSE
    IF array_ndims(p_answers) IS DISTINCT FROM 1 OR cardinality(p_answers) <> 7
      OR EXISTS (SELECT 1 FROM unnest(p_answers) answer WHERE answer IS NULL OR answer NOT BETWEEN 0 AND 2)
    THEN
      RAISE EXCEPTION 'Answer all seven questions' USING ERRCODE = '22023';
    END IF;
    SELECT count(*)::integer INTO score
    FROM unnest(p_answers) WITH ORDINALITY AS submitted(answer, position)
    WHERE submitted.answer = answer_key[submitted.position];

    INSERT INTO public.academy_pilot_student_loan_exam (advisor_id, best_correct) VALUES (actor, score)
    ON CONFLICT (advisor_id) DO UPDATE SET best_correct = greatest(academy_pilot_student_loan_exam.best_correct, excluded.best_correct)
    RETURNING best_correct INTO best;
  END IF;

  RETURN jsonb_build_object('score', score, 'best', best);
END;
$$;

REVOKE ALL ON FUNCTION public.academy_pilot_student_loan_exam(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_pilot_student_loan_exam(integer[]) TO authenticated;

DROP FUNCTION public.academy_pilot_owner_overview();

CREATE FUNCTION public.academy_pilot_owner_overview()
RETURNS TABLE (
  advisor_id uuid,
  advisor_name text,
  completed text[],
  last_lesson text,
  core_exam_best integer,
  core_certificate_id uuid,
  core_certificate_issued_at timestamptz,
  student_loan_exam_best integer
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
           exam.certificate_id, exam.certificate_issued_at, specialty.best_correct
    FROM public.profiles p
    LEFT JOIN public.academy_pilot_progress progress ON progress.advisor_id = p.id
    LEFT JOIN public.academy_pilot_core_exam exam ON exam.advisor_id = p.id
    LEFT JOIN public.academy_pilot_student_loan_exam specialty ON specialty.advisor_id = p.id
    WHERE p.is_active AND p.deleted_at IS NULL AND p.role = 'advisor'
    ORDER BY 2, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.academy_pilot_owner_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_pilot_owner_overview() TO authenticated;

COMMIT;
