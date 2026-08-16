/** Static contract markers for Migration 033 writing-advisor compensation foundation. */

export const MIGRATION_033_FILENAME = '033_writing_advisor_compensation_foundation.sql'

export const MIGRATION_033_CONTRACT_MARKERS = [
  'advisor_profiles.contract_level',
  "contract_level IN ('FA', 'SFA', 'SM', 'ED')",
  'set_advisor_contract_level',
  'writing_contract_level',
  'CREATE TABLE IF NOT EXISTS public.product_compensation_schedules',
  'fa_rate numeric(8, 6) NOT NULL',
  'sfa_rate numeric(8, 6) NOT NULL',
  'sm_rate numeric(8, 6) NOT NULL',
  'ed_rate numeric(8, 6) NOT NULL',
  'product_comp_schedules_live_unique_idx',
  'create_product_compensation_schedule',
  'update_product_compensation_schedule',
  'deactivate_product_compensation_schedule',
  'enforce_product_comp_schedule_delete_guard',
  'pp_comp_schedule_overlaps_live',
  'FORCE ROW LEVEL SECURITY',
  'SET search_path = pg_catalog, public, extensions',
  'submission_date',
  'review_required',
  'writing-advisor compensation only',
] as const

export const MIGRATION_033_FORBIDDEN_MARKERS = [
  '034_',
  'CREATE TYPE public.advisor_contract_level',
  'btree_gist',
  'EXCLUDE USING',
  'upline_id',
  'override_rate',
  'generational_rate',
  'hierarchy_rate',
  'spread_rate',
  'CREATE TABLE public.commission_expectations',
  'CREATE TABLE public.commission_transactions',
  'expected_cents',
  'chargeback',
  'Excel Empire',
  'TrusteeFriend',
  'product_compensation_schedules_source_legacy',
  '03-Experior',
] as const
