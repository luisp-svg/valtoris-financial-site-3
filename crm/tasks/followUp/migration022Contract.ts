/**
 * Migration 022 contract snippets used by unit tests.
 * Avoids node:fs imports under the browser tsconfig.
 */
export const MIGRATION_022_CONTRACT_MARKERS = [
  'ADD COLUMN IF NOT EXISTS lead_id',
  'ADD COLUMN IF NOT EXISTS assessment_id',
  'automation_idempotency_key',
  'tasks_source_type_check',
  'review_initial_diagnostic',
  'resolve_possible_duplicate',
  'tasks_automation_idempotency_key_uidx',
  'follow_up_task_automation_status',
  'create_public_family_follow_up_task',
  'update_public_family_task_automation_status',
  'REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task',
  'FROM anon',
  'GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task',
  'TO service_role',
  'soft_deleted_task_exists',
  'public_family_follow_up_task_created',
  '::date + 1',
  '::date + 3',
] as const

export const MIGRATION_022_FORBIDDEN_MARKERS = [
  'contact_permitted_follow_up',
  'consent_review_required',
] as const
