-- Remove Sprint 4A.3 QA fixtures created by seed-crm-scenarios.sql
BEGIN;

DELETE FROM public.tasks
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.notes
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.activities
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.duplicate_reviews
WHERE provisional_household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
)
OR candidate_household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
)
OR incoming_lead_id IN (
  SELECT id FROM public.leads WHERE source_page = '/qa-sprint-4a3'
);

DELETE FROM public.assessments
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.leads
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
)
OR source_page = '/qa-sprint-4a3';

DELETE FROM public.household_members
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.households
WHERE display_name LIKE '[QA4A3]%';

COMMIT;
