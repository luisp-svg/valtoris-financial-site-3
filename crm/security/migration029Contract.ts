/** Static contract markers for Migration 029 Phase A security hardening. */

export const MIGRATION_029_FILENAME =
  '029_security_hardening_opportunities_and_relationships.sql'

export const MIGRATION_029_CONTRACT_MARKERS = [
  'crm_can_access_opportunity',
  'crm_can_access_household(household_id)',
  'crm_assert_subject_fks_same_household',
  'CRM029:subject_relationship_invalid',
  'enforce_document_relationship_integrity',
  'enforce_note_relationship_integrity',
  'enforce_activity_relationship_integrity',
  'enforce_task_access_integrity',
  'record_crm_activity',
  "p_event_key text",
  "'tasks.manual.created'",
  "'onboarding.completed'",
  'CRM029:event_key_not_allowed',
  'CRM029:task_id_required',
  'CRM029:assessment_id_required',
  'opportunity_assignment_history_rows',
  'REVOKE ALL ON TABLE public.activities FROM authenticated',
  'GRANT SELECT, INSERT ON TABLE public.activities TO authenticated',
  "v_ctx IS DISTINCT FROM 'assign_household'",
] as const

export const MIGRATION_029_FORBIDDEN_MARKERS = [
  '030_',
  'Task Completion',
  'complete_task',
  'CREATE TABLE public.cases',
  'aiSummaryRef',
  'workflowRunId',
  'documentId',
  'p_occurred_at',
  'p_activity_type',
  'p_title text',
  'p_body text',
] as const

export const MIGRATION_029_TASK_METADATA_ALLOWLIST = [
  'taskId',
  'workflowType',
  'sourceType',
  'idempotencyKey',
] as const

export const MIGRATION_029_ONBOARDING_METADATA_ALLOWLIST = [
  'assessmentType',
  'idempotencyKey',
] as const

export const MIGRATION_029_METADATA_MAX_BYTES = 4096

/** Soft metadata only — Migration 029 does not add a uniqueness constraint. */
export const MIGRATION_029_IDEMPOTENCY_ENFORCED = false
