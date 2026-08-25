/** Static contract markers for Migration 051 safe Intake archive RPC. */

export const MIGRATION_051_FILENAME = '051_intake_archive_workflow.sql'

export const MIGRATION_051_RPC = 'archive_intake_lead'

export const MIGRATION_051_REASONS = [
  'dismissed',
  'not_a_fit',
  'spam',
  'test_or_accidental',
] as const

export const MIGRATION_051_INTAKE_LEAD_TYPES = [
  'Family Report Card',
  'Business Report Card',
  'Retirement Report Card',
  'Protection Gap',
  'Student Loan Report Card',
  'Credit Report Card',
  'Digital Identity',
] as const

export const MIGRATION_051_ORDINARY_FOLLOW_UP_WORKFLOWS = [
  'review_initial_diagnostic',
  'review_digital_identity_lead',
] as const

export const MIGRATION_051_DUPLICATE_WORKFLOWS = [
  'resolve_possible_duplicate',
  'resolve_digital_identity_duplicate',
] as const

export const MIGRATION_051_CONTRACT_MARKERS = [
  'CREATE OR REPLACE FUNCTION public.archive_intake_lead(',
  'p_lead_id uuid',
  'p_reason text',
  'RETURNS jsonb',
  'SECURITY DEFINER',
  'SET search_path = pg_catalog, public, extensions',
  'ALTER FUNCTION public.archive_intake_lead(uuid, text) OWNER TO postgres',
  'REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM anon',
  'GRANT EXECUTE ON FUNCTION public.archive_intake_lead(uuid, text) TO authenticated',
  "CRM_INTAKE:not_authenticated",
  "CRM_INTAKE:invalid_reason",
  "CRM_INTAKE:not_authorized",
  "CRM_INTAKE:already_archived",
  "CRM_INTAKE:not_intake_lead",
  "CRM_INTAKE:duplicate_review_pending",
  "'dismissed', 'not_a_fit', 'spam', 'test_or_accidental'",
  "'Family Report Card'",
  "'Business Report Card'",
  "'Retirement Report Card'",
  "'Protection Gap'",
  "'Student Loan Report Card'",
  "'Credit Report Card'",
  "'Digital Identity'",
  "'Manual Contact'",
  'public.crm_is_owner()',
  'public.crm_can_access_household(v_lead.household_id)',
  "v_lead.status = 'duplicate_review'::public.lead_status",
  "dr.status = 'pending'",
  'SET deleted_at = now()',
  "'review_initial_diagnostic'",
  "'review_digital_identity_lead'",
  "'resolve_possible_duplicate'",
  "'resolve_digital_identity_duplicate'",
  "status = 'done'",
  'PERFORM public.crm_write_activity(',
  "'system'::public.activity_type",
  "'Intake archived'",
  "'follow_up_task_completed'",
] as const

export const MIGRATION_051_FORBIDDEN_MARKERS = [
  '052_',
  'CREATE TABLE',
  'CREATE TABLE IF NOT EXISTS',
  'ALTER TABLE',
  'ALTER TYPE',
  'CREATE TYPE',
  'ADD COLUMN',
  'DELETE FROM',
  'GRANT DELETE',
  'TO anon',
  'INSERT INTO public.opportunities',
  'INSERT INTO public.activities',
  'INSERT INTO public.policy_applications',
  'record_crm_activity',
  'GRANT INSERT ON TABLE public.activities',
  'CREATE POLICY',
  'ENABLE ROW LEVEL SECURITY',
  'CREATE TRIGGER',
  'credit_repair',
  'ingest_public_report_card',
  'create_public_family_follow_up_task',
  'resolve_public_family_duplicate_review',
  'assign_household',
  'quick_add_contact',
  'CREATE TABLE public.contacts',
  'sheets',
  'reviewed_at',
] as const
