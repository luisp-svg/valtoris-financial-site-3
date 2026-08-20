/** Static contract markers for Migration 043 public Report Card ingest generalization. */

export const MIGRATION_043_FILENAME = '043_public_report_card_ingest.sql'

export const MIGRATION_043_CONTRACT_MARKERS = [
  'CREATE OR REPLACE FUNCTION public.ingest_public_report_card(p_payload jsonb)',
  "v_assessment_type NOT IN (\n    'family', 'business', 'retirement', 'protection'",
  'invalid_assessment_type',
  'invalid_lead_type',
  "'Family Report Card'",
  "'Business Report Card'",
  "'Retirement Report Card'",
  "'Protection Gap'",
  "capture_channel,",
  "'public_self_report'",
  'original_advisor_id',
  'CREATE OR REPLACE FUNCTION public.ingest_public_family_report_card(p_payload jsonb)',
  "'assessment_type', 'family'",
  "'lead_type', 'Family Report Card'",
  'GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO service_role',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM anon',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM authenticated',
  'create_public_family_follow_up_task',
  'resolve_public_family_duplicate_review',
  'Does not create tables',
] as const

export const MIGRATION_043_FORBIDDEN_MARKERS = [
  '044_',
  'CREATE TABLE public.',
  'CREATE TABLE IF NOT EXISTS',
  'CREATE OR REPLACE FUNCTION public.ingest_public_business_report_card',
  'CREATE OR REPLACE FUNCTION public.ingest_public_retirement_report_card',
  'CREATE OR REPLACE FUNCTION public.ingest_public_protection',
  'GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO anon',
  'GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO authenticated',
  'GRANT INSERT',
  'GRANT UPDATE',
  'GRANT DELETE',
  'CREATE TABLE public.opportunities',
] as const
