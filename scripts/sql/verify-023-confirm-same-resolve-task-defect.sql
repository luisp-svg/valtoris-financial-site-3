-- Prove Sprint 4A.3 confirm-same / resolve-task interaction (NOT a migration).
-- Run after: npx supabase db reset && seed scripts/sql/qa-sprint-4a3/seed-crm-scenarios.sql
--
-- Expected AFTER migration 023:
--   s05_all_tasks = 1, s05_unexpected_tasks = 0
--   s05_blocked_by_021_task_count = true   (legacy 021 counting rule)
--   s05_safe_under_proposed_023 = true     (023 exclusion rule)
--   s10_would_block_confirm = true         (extra assessment still unsafe)

\pset pager off

WITH s05 AS (
  SELECT
    'a4a30005-0005-4000-8000-000000000005'::uuid AS provisional_id,
    'c4a30005-0005-4000-8000-000000000005'::uuid AS assessment_id,
    'b4a30005-0005-4000-8000-000000000005'::uuid AS lead_id
),
counts AS (
  SELECT
    (SELECT count(*) FROM public.household_members hm, s05
      WHERE hm.household_id = s05.provisional_id AND hm.deleted_at IS NULL) AS members,
    (SELECT count(*) FROM public.leads l, s05
      WHERE l.household_id = s05.provisional_id AND l.deleted_at IS NULL) AS leads,
    (SELECT count(*) FROM public.assessments a, s05
      WHERE a.household_id = s05.provisional_id AND a.deleted_at IS NULL) AS assessments,
    (SELECT count(*) FROM public.tasks t, s05
      WHERE t.household_id = s05.provisional_id AND t.deleted_at IS NULL) AS all_tasks,
    (SELECT count(*) FROM public.tasks t, s05
      WHERE t.household_id = s05.provisional_id
        AND t.deleted_at IS NULL
        AND NOT (
          t.workflow_type = 'resolve_possible_duplicate'
          AND t.assessment_id = s05.assessment_id
          AND t.lead_id = s05.lead_id
          AND t.source_type IN ('public_family_ingest', 'duplicate_resolution', 'system')
        )) AS unexpected_tasks
)
SELECT
  members,
  leads,
  assessments,
  all_tasks AS s05_all_tasks,
  unexpected_tasks AS s05_unexpected_tasks,
  (members = 1 AND leads = 1 AND assessments = 1 AND all_tasks <> 0) AS s05_blocked_by_021_task_count,
  (members = 1 AND leads = 1 AND assessments = 1 AND unexpected_tasks = 0) AS s05_safe_under_proposed_023
FROM counts;

SELECT
  count(*) AS s10_assessments,
  (count(*) <> 1) AS s10_would_block_confirm
FROM public.assessments
WHERE household_id = 'a4a30010-0010-4000-8000-000000000010'
  AND deleted_at IS NULL;
