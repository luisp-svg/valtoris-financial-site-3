/** Static contract markers for Migration 049 public report-card follow-up copy. */

export const MIGRATION_049_FILENAME = '049_specialize_public_report_card_follow_up_copy.sql'

export const MIGRATION_049_FUNCTION = 'create_public_family_follow_up_task'

export const MIGRATION_049_COPY = {
  familyTitle: 'Review Initial Financial Diagnostic and follow up',
  familyDescription:
    'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.',
  familyActivity: 'Internal review task created for a public Family Initial Financial Diagnostic.',
  business: 'Business Report Card',
  retirement: 'Retirement Report Card',
  protection: 'Protection Gap Analysis',
  studentLoan: 'Student Loan Report Card',
  studentLoanTitle: 'Review Student Loan Report Card and follow up',
  studentLoanActivity: 'Follow-up review task created for public Student Loan Report Card.',
  workflowType: 'review_initial_diagnostic',
} as const

export const MIGRATION_049_CONTRACT_MARKERS = [
  'CREATE OR REPLACE FUNCTION public.create_public_family_follow_up_task(',
  "WHEN 'family' THEN 'Initial Financial Diagnostic'",
  "WHEN 'business' THEN 'Business Report Card'",
  "WHEN 'retirement' THEN 'Retirement Report Card'",
  "WHEN 'protection' THEN 'Protection Gap Analysis'",
  "WHEN 'student_loan' THEN 'Student Loan Report Card'",
  "v_title := 'Review Initial Financial Diagnostic and follow up'",
  "v_title := 'Review ' || v_product || ' and follow up'",
  "'Follow-up review task created for public ' || v_product || '.'",
  "v_activity_body := 'Internal review task created for a public Family Initial Financial Diagnostic.'",
  "'review_initial_diagnostic'",
  'GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO authenticated',
  'GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO service_role',
  'REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM anon',
  'REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM authenticated',
  'ALTER FUNCTION public.create_public_family_follow_up_task(uuid, text, text) OWNER TO postgres',
  'SECURITY DEFINER',
  'SET search_path = pg_catalog, public, extensions',
] as const

export const MIGRATION_049_FORBIDDEN_MARKERS = [
  '050_',
  'CREATE TABLE',
  'CREATE TABLE IF NOT EXISTS',
  'ALTER TABLE',
  'CREATE TYPE',
  'CREATE POLICY',
  'ENABLE ROW LEVEL SECURITY',
  'CREATE TRIGGER',
  'CREATE OR REPLACE FUNCTION public.ingest_public_report_card',
  'CREATE OR REPLACE FUNCTION public.ingest_public_student_loan',
  'CREATE OR REPLACE FUNCTION public.resolve_public_family_duplicate_review',
  'INSERT INTO public.opportunities',
  'INSERT INTO public.policy_applications',
  'INSERT INTO public.policies',
  'INSERT INTO public.policy_writing_commission_events',
  'record_policy_writing_commission_event',
  'convert_opportunity_to_policy_application',
  'service_cases',
  'service_revenue_events',
  'GRANT INSERT',
  'GRANT UPDATE',
  'GRANT DELETE',
  'TO anon',
  'scoreStudentLoanAssessment',
  'overall_score',
] as const
