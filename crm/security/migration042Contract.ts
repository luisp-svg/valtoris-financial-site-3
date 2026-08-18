/** Static contract markers for Migration 042 writing-receivable eligibility. */

export const MIGRATION_042_FILENAME = '042_writing_receivable_eligibility.sql'

export const MIGRATION_042_CONTRACT_MARKERS = [
  'ALTER TABLE public.policy_applications',
  'ADD COLUMN IF NOT EXISTS writing_receivable_expected boolean NOT NULL DEFAULT true',
  'set_policy_application_writing_receivable_expected',
  'pp_assert_owner()',
  'SET search_path = pg_catalog, public, extensions',
  'IF v_app.writing_receivable_expected IS NOT TRUE THEN',
  'historical_entry does NOT set this',
  'writing_receivable_expected defaults true',
  'crm_write_audit',
  "'set_policy_application_writing_receivable_expected'",
  'enforce_policy_expected_comp_immutability',
  'GRANT EXECUTE ON FUNCTION public.set_policy_application_writing_receivable_expected(uuid, boolean, text)',
  'REVOKE ALL ON FUNCTION public.set_policy_application_writing_receivable_expected(uuid, boolean, text)',
  'FROM PUBLIC, anon',
  'Does not change stage, protection, allocations, 035, Pending, Paid, or Chargebacks',
] as const

export const MIGRATION_042_FORBIDDEN_MARKERS = [
  '043_',
  'CREATE TABLE public.commission_status',
  'CREATE TABLE IF NOT EXISTS public.expected_compensation_exclusions',
  'CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event',
  'CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event_pre_issue',
  'CREATE OR REPLACE FUNCTION public.reverse_policy_writing_commission_event',
  'CREATE OR REPLACE FUNCTION public.create_commission_pending_import_batch',
  'CREATE OR REPLACE FUNCTION public.stage_commission_pending_import_rows',
  'CREATE OR REPLACE FUNCTION public.review_commission_pending_import_row',
  'CREATE OR REPLACE FUNCTION public.post_commission_import_row',
  'effective_from <= DATE',
  'created_at <',
  'upline_id',
  'override_rate',
  'generational_rate',
  'TO anon',
  'GRANT INSERT',
  'GRANT UPDATE',
  'GRANT DELETE',
  "historical_entry IS TRUE THEN\n    v_writing_receivable",
] as const
