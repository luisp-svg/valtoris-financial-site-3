-- Development candidate. Requires the student loan certificate setup.
BEGIN;

ALTER TABLE public.academy_pilot_student_loan_exam
  ADD COLUMN expanded_best_correct integer CHECK (expanded_best_correct BETWEEN 0 AND 7),
  ADD COLUMN expanded_last_correct integer CHECK (expanded_last_correct BETWEEN 0 AND 7),
  ADD COLUMN expanded_last_attempt_at timestamptz,
  ADD CONSTRAINT academy_expanded_exam_result_complete CHECK (
    (expanded_best_correct IS NULL AND expanded_last_correct IS NULL AND expanded_last_attempt_at IS NULL)
    OR (expanded_best_correct IS NOT NULL AND expanded_last_correct IS NOT NULL
        AND expanded_last_attempt_at IS NOT NULL AND expanded_best_correct >= expanded_last_correct)
  );

-- Historical best scores have no revision metadata, so expanded results start empty.
CREATE FUNCTION public.academy_pilot_student_loan_expanded_exam(p_answers integer[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  legacy_result jsonb;
  current_result public.academy_pilot_student_loan_exam%ROWTYPE;
BEGIN
  -- Reuse the existing server grader, profile checks, prerequisites and certificate issuer.
  legacy_result := public.academy_pilot_student_loan_exam(p_answers);
  IF p_answers IS NOT NULL THEN
    UPDATE public.academy_pilot_student_loan_exam exam
    SET expanded_best_correct = greatest(exam.expanded_best_correct, (legacy_result->>'score')::integer),
        expanded_last_correct = (legacy_result->>'score')::integer,
        expanded_last_attempt_at = statement_timestamp()
    WHERE exam.advisor_id = auth.uid()
    RETURNING exam.* INTO current_result;
  ELSE
    SELECT * INTO current_result FROM public.academy_pilot_student_loan_exam WHERE advisor_id = auth.uid();
  END IF;
  RETURN legacy_result || jsonb_build_object(
    'best', current_result.expanded_best_correct,
    'lastScore', current_result.expanded_last_correct,
    'lastAttemptAt', current_result.expanded_last_attempt_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.academy_pilot_student_loan_expanded_exam(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_pilot_student_loan_expanded_exam(integer[]) TO authenticated;

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
  student_loan_exam_best integer,
  student_loan_certificate_id uuid,
  student_loan_certificate_issued_at timestamptz,
  student_loan_expanded_exam_best integer,
  student_loan_expanded_exam_last integer,
  student_loan_expanded_exam_attempted_at timestamptz
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
           exam.certificate_id, exam.certificate_issued_at, specialty.best_correct,
           specialty.certificate_id, specialty.certificate_issued_at,
           specialty.expanded_best_correct, specialty.expanded_last_correct, specialty.expanded_last_attempt_at
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
