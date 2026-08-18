/** Static contract markers for Migration 041 Experior Pending review RPC. */

export const MIGRATION_041_FILENAME = '041_commission_pending_review.sql'

export const MIGRATION_041_CONTRACT_MARKERS = [
  'CREATE OR REPLACE FUNCTION public.enforce_commission_pending_import_immutability()',
  'review_commission_pending_import_row',
  "'create_commission_pending_import_batch'",
  "'stage_commission_pending_import_rows'",
  "v_action NOT IN ('accept', 'confirm_duplicate', 'confirm_distinct')",
  "pending_review_status = 'accepted_pending'",
  "pending_review_status = 'duplicate'",
  'pp_assert_owner()',
  'SET search_path = pg_catalog, public, extensions',
  'resolved_advisor_id = v_alloc.advisor_id',
  "allocation_role = 'writing'",
  "recipient_type = 'advisor'",
  'effective_to IS NULL',
  'source_income_cents',
  'crm_write_audit',
  'GRANT EXECUTE ON FUNCTION public.review_commission_pending_import_row(',
  'Does not write 035',
] as const

export const MIGRATION_041_FORBIDDEN_MARKERS = [
  '042_',
  'CREATE TABLE',
  'ALTER TABLE',
  'posted_commission_event_id',
  'CREATE OR REPLACE FUNCTION public.review_commission_import_row(',
  'CREATE OR REPLACE FUNCTION public.post_commission_import_row(',
  'CREATE OR REPLACE FUNCTION public.create_commission_import_batch(',
  'CREATE OR REPLACE FUNCTION public.stage_commission_import_rows(',
  'CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event',
  'CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event_pre_issue',
  'CREATE OR REPLACE FUNCTION public.reverse_policy_writing_commission_event',
  'CREATE OR REPLACE FUNCTION public.attribute_unattributed_commission_event',
  'CREATE OR REPLACE FUNCTION public.pp_refresh_application_expected_compensation',
  'CREATE OR REPLACE FUNCTION public.create_commission_pending_import_batch(',
  'CREATE OR REPLACE FUNCTION public.stage_commission_pending_import_rows(',
  "event_type IN ('pending'",
  'current_pending_cents',
  'upline_id',
  'override_rate',
  'generational_rate',
  'TO anon',
] as const
