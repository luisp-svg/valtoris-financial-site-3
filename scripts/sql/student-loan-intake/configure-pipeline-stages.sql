-- Configure the Student Loans workflow without moving opportunities or changing closed outcomes.
BEGIN;

DO $configure$
DECLARE
  loan_pipeline constant uuid := '22222222-2222-2222-2222-222222222216';
BEGIN
  PERFORM 1 FROM public.pipelines p
  JOIN public.service_verticals v ON v.id = p.service_vertical_id
  WHERE p.id = loan_pipeline AND p.is_active AND v.code = 'student_loans'
  FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected active Student Loans pipeline was not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages
    WHERE pipeline_id = loan_pipeline AND code = 'sold' AND is_won AND NOT is_lost
  ) OR NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages
    WHERE pipeline_id = loan_pipeline AND code = 'closed_lost' AND is_lost AND is_terminal
  ) OR NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages
    WHERE pipeline_id = loan_pipeline AND code = 'presented' AND NOT (is_won OR is_lost OR is_terminal)
  ) THEN
    RAISE EXCEPTION 'Unexpected Student Loans stage configuration';
  END IF;

  UPDATE public.pipeline_stages SET name = 'Closed / Lost', sort_order = 7
  WHERE pipeline_id = loan_pipeline AND code = 'closed_lost' AND sort_order <> 7;

  UPDATE public.pipeline_stages SET name = 'Complete', sort_order = 6
  WHERE pipeline_id = loan_pipeline AND code = 'sold' AND (name <> 'Complete' OR sort_order <> 6);

  UPDATE public.pipeline_stages SET name = 'Onboarding'
  WHERE pipeline_id = loan_pipeline AND code = 'presented' AND name <> 'Onboarding';

  INSERT INTO public.pipeline_stages (pipeline_id, code, name, sort_order)
  VALUES (loan_pipeline, 'student_loan_fulfillment', 'Fulfillment', 4),
         (loan_pipeline, 'student_loan_processing', 'Processing', 5)
  ON CONFLICT (pipeline_id, code) DO NOTHING;

  IF (SELECT array_agg(name ORDER BY sort_order) FROM public.pipeline_stages
      WHERE pipeline_id = loan_pipeline AND code NOT IN ('identified', 'closed_lost'))
      IS DISTINCT FROM ARRAY['Consultation','Onboarding','Fulfillment','Processing','Complete']::text[] THEN
    RAISE EXCEPTION 'Student Loans workflow did not match the expected stages';
  END IF;
END
$configure$;

COMMIT;
