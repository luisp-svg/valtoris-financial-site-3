/** Static contract markers for Migration 048 Student Loan public ingest type enablement. */

export const MIGRATION_048_FILENAME = '048_student_loan_report_card_ingest.sql'

export const MIGRATION_048_ASSESSMENT_TYPE = 'student_loan'
export const MIGRATION_048_LEAD_TYPE = 'Student Loan Report Card'
export const MIGRATION_048_LEAD_SOURCE = 'student_loan_report_card'

export const EXISTING_PUBLIC_ASSESSMENT_TYPES = [
  'family',
  'business',
  'retirement',
  'protection',
] as const

export const EXISTING_PUBLIC_LEAD_TYPES = [
  'Family Report Card',
  'Business Report Card',
  'Retirement Report Card',
  'Protection Gap',
] as const

export const EXISTING_PUBLIC_LEAD_SOURCES = [
  'family_report_card',
  'business_report_card',
  'retirement_report_card',
  'protection_gap',
] as const

export const MIGRATION_048_CONTRACT_MARKERS = [
  "ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'student_loan'",
  "CREATE OR REPLACE FUNCTION public.ingest_public_report_card(p_payload jsonb)",
  "'family', 'business', 'retirement', 'protection', 'student_loan'",
  "WHEN 'student_loan' THEN 'Student Loan Report Card'",
  "WHEN 'student_loan' THEN 'student_loan_report_card'",
  "WHEN 'family' THEN 'Family Report Card'",
  "WHEN 'business' THEN 'Business Report Card'",
  "WHEN 'retirement' THEN 'Retirement Report Card'",
  "WHEN 'protection' THEN 'Protection Gap'",
  "WHEN 'family' THEN 'family_report_card'",
  "WHEN 'business' THEN 'business_report_card'",
  "WHEN 'retirement' THEN 'retirement_report_card'",
  "WHEN 'protection' THEN 'protection_gap'",
  'CREATE OR REPLACE FUNCTION public.create_public_family_follow_up_task(',
  'CREATE OR REPLACE FUNCTION public.resolve_public_family_duplicate_review(',
  "'Student Loan Report Card'",
  'GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO service_role',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM anon',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM authenticated',
] as const

export const MIGRATION_048_FORBIDDEN_MARKERS = [
  '049_',
  'CREATE TABLE',
  'CREATE TABLE IF NOT EXISTS',
  'ALTER TABLE',
  'CREATE TYPE',
  'CREATE OR REPLACE FUNCTION public.ingest_public_student_loan',
  'CREATE OR REPLACE FUNCTION public.ingest_public_family_report_card',
  'GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO anon',
  'GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO authenticated',
  'INSERT INTO public.opportunities',
  'INSERT INTO public.policy_applications',
  'INSERT INTO public.policies',
  'INSERT INTO public.policy_writing_commission_events',
  'record_policy_writing_commission_event',
  'convert_opportunity_to_policy_application',
  'CREATE POLICY',
  'ENABLE ROW LEVEL SECURITY',
  'service_cases',
  'service_revenue_events',
  'GRANT INSERT',
  'GRANT UPDATE',
  'GRANT DELETE',
  'TO anon',
  'credit_repair',
  'CREATE OR REPLACE FUNCTION public.ingest_public_credit',
] as const
