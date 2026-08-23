/** Static contract markers for Migration 047 Credit Repair / Student Loan sales catalog. */

export const MIGRATION_047_FILENAME = '047_credit_repair_student_loan_sales_catalog.sql'

export const CREDIT_REPAIR_VERTICAL_ID = '11111111-1111-1111-1111-111111111105'
export const STUDENT_LOANS_VERTICAL_ID = '11111111-1111-1111-1111-111111111106'
export const CREDIT_REPAIR_PIPELINE_ID = '22222222-2222-2222-2222-222222222215'
export const STUDENT_LOANS_PIPELINE_ID = '22222222-2222-2222-2222-222222222216'

export const SERVICE_SALES_STAGE_CODES = [
  'identified',
  'consultation',
  'presented',
  'sold',
  'closed_lost',
] as const

export const MIGRATION_047_CONTRACT_MARKERS = [
  CREDIT_REPAIR_VERTICAL_ID,
  STUDENT_LOANS_VERTICAL_ID,
  "'credit_repair'",
  "'student_loans'",
  "'Credit Repair'",
  "'Student Loans'",
  CREDIT_REPAIR_PIPELINE_ID,
  STUDENT_LOANS_PIPELINE_ID,
  "'Credit Repair Pipeline'",
  "'Student Loans Pipeline'",
  "public._seed_pipeline_stages",
  '"code":"identified"',
  '"code":"consultation"',
  '"code":"presented"',
  '"code":"sold"',
  '"code":"closed_lost"',
  '"is_won":true',
  '"is_lost":true',
  '"is_terminal":true',
] as const

export const MIGRATION_047_FORBIDDEN_MARKERS = [
  '048_',
  'CREATE TABLE',
  'CREATE TYPE',
  'ALTER TABLE',
  'ALTER TYPE',
  'ADD VALUE',
  'CREATE OR REPLACE FUNCTION',
  'CREATE POLICY',
  'ENABLE ROW LEVEL SECURITY',
  'service_cases',
  'service_revenue_events',
  'record_policy_writing_commission_event',
  'pp_refresh_application_expected_compensation',
  'set_policy_application_writing_receivable_expected',
  'convert_opportunity_to_policy_application',
  'INSERT INTO public.policy_applications',
  'INSERT INTO public.policies',
  'INSERT INTO public.policy_writing_commission_events',
  'GRANT INSERT',
  'GRANT UPDATE',
  'GRANT DELETE',
  'TO anon',
  'enrolled',
  'package',
  'sale_amount',
  'payment_structure',
] as const
