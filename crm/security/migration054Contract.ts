/** Static contract markers for Migration 054 Home Buyer Report Card public ingest enablement. */

export const MIGRATION_054_FILENAME = '054_home_buyer_report_card_ingest.sql'

export const MIGRATION_054_ASSESSMENT_TYPE = 'home_buyer'
export const MIGRATION_054_LEAD_TYPE = 'Home Buyer Report Card'
export const MIGRATION_054_LEAD_SOURCE = 'home_buyer_report_card'
export const MIGRATION_054_ACTIVITY_SOURCE = 'public_home_buyer_report_card'

export const EXISTING_PUBLIC_ASSESSMENT_TYPES = [
  'family',
  'business',
  'retirement',
  'protection',
  'student_loan',
  'credit',
] as const

export const EXISTING_PUBLIC_LEAD_TYPES = [
  'Family Report Card',
  'Business Report Card',
  'Retirement Report Card',
  'Protection Gap',
  'Student Loan Report Card',
  'Credit Report Card',
] as const

export const EXISTING_PUBLIC_LEAD_SOURCES = [
  'family_report_card',
  'business_report_card',
  'retirement_report_card',
  'protection_gap',
  'student_loan_report_card',
  'credit_report_card',
] as const

export const MIGRATION_054_COPY = {
  product: 'Home Buyer Report Card',
  title: 'Review Home Buyer Report Card and follow up',
  activity: 'Follow-up review task created for public Home Buyer Report Card.',
  noContactTitle: 'Review Home Buyer Report Card — no contact permission',
  workflowType: 'review_initial_diagnostic',
} as const

export const MIGRATION_054_FUNCTIONS = [
  'ingest_public_report_card',
  'create_public_family_follow_up_task',
  'resolve_public_family_duplicate_review',
] as const

export const MIGRATION_054_CONTRACT_MARKERS = [
  "ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'home_buyer'",
  "CREATE OR REPLACE FUNCTION public.ingest_public_report_card(p_payload jsonb)",
  "'family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer'",
  "WHEN 'home_buyer' THEN 'Home Buyer Report Card'",
  "WHEN 'home_buyer' THEN 'home_buyer_report_card'",
  "WHEN 'home_buyer' THEN 'Home Buyer Report Card submitted'",
  "WHEN 'home_buyer' THEN 'Public Home Buyer Report Card captured.'",
  "WHEN 'home_buyer' THEN 'Home Buyer Report Card assessment completed'",
  "WHEN 'home_buyer' THEN 'public_home_buyer_report_card'",
  "WHEN 'family' THEN 'Family Report Card'",
  "WHEN 'business' THEN 'Business Report Card'",
  "WHEN 'retirement' THEN 'Retirement Report Card'",
  "WHEN 'protection' THEN 'Protection Gap'",
  "WHEN 'student_loan' THEN 'Student Loan Report Card'",
  "WHEN 'credit' THEN 'Credit Report Card'",
  "WHEN 'family' THEN 'family_report_card'",
  "WHEN 'business' THEN 'business_report_card'",
  "WHEN 'retirement' THEN 'retirement_report_card'",
  "WHEN 'protection' THEN 'protection_gap'",
  "WHEN 'student_loan' THEN 'student_loan_report_card'",
  "WHEN 'credit' THEN 'credit_report_card'",
  'CREATE OR REPLACE FUNCTION public.create_public_family_follow_up_task(',
  'CREATE OR REPLACE FUNCTION public.resolve_public_family_duplicate_review(',
  "v_title := 'Review ' || v_product || ' and follow up'",
  "'Follow-up review task created for public ' || v_product || '.'",
  "'review_initial_diagnostic'",
  'GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO service_role',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM anon',
  'REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM authenticated',
  'GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO authenticated',
  'GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO service_role',
  'REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM anon',
  'REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM authenticated',
  'GRANT EXECUTE ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) TO authenticated',
  'REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM anon',
  'REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM authenticated',
] as const

export const MIGRATION_054_FORBIDDEN_MARKERS = [
  '055_',
  'CREATE TABLE',
  'CREATE TABLE IF NOT EXISTS',
  'ALTER TABLE',
  'CREATE TYPE',
  'CREATE OR REPLACE FUNCTION public.ingest_public_home_buyer',
  'CREATE OR REPLACE FUNCTION public.ingest_public_credit',
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
  'CREATE TRIGGER',
  'service_cases',
  'service_revenue_events',
  'GRANT INSERT',
  'GRANT UPDATE',
  'GRANT DELETE',
  'TO anon',
  'credit_repair',
  'credit_repair_case',
  'SSN',
  'social_security',
  'bureau_password',
  'dispute_letter',
  'ocr',
  'idiq',
  'IDIQ',
  'credit_pull',
  'fico_login',
  'mortgage_vertical',
  'Mortgage Ready',
  'Prequalified',
  'scoreHomeBuyerAssessment',
  'scoreStudentLoanAssessment',
] as const
