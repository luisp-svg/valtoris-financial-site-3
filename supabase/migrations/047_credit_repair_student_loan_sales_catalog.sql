-- 047_credit_repair_student_loan_sales_catalog.sql
-- Data-only catalog seed: Credit Repair and Student Loan sales verticals.
-- Reuses public._seed_pipeline_stages from Migration 011.
-- No tables, columns, enums, RPCs, RLS, triggers, or insurance/commission changes.

-- Fixed UUIDs for stable references across environments (not secrets).
-- Verticals
-- 11111111-1111-1111-1111-111111111105 credit_repair
-- 11111111-1111-1111-1111-111111111106 student_loans
-- Pipelines
-- 22222222-2222-2222-2222-222222222215 credit_repair
-- 22222222-2222-2222-2222-222222222216 student_loans

INSERT INTO public.service_verticals (id, code, name, description, is_active, sort_order)
VALUES
  (
    '11111111-1111-1111-1111-111111111105',
    'credit_repair',
    'Credit Repair',
    'Credit repair client-sales opportunities',
    true,
    5
  ),
  (
    '11111111-1111-1111-1111-111111111106',
    'student_loans',
    'Student Loans',
    'Student loan client-sales opportunities',
    true,
    6
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.pipelines (id, name, pipeline_type, service_vertical_id, is_default, is_active)
VALUES
  (
    '22222222-2222-2222-2222-222222222215',
    'Credit Repair Pipeline',
    'service',
    '11111111-1111-1111-1111-111111111105',
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222216',
    'Student Loans Pipeline',
    'service',
    '11111111-1111-1111-1111-111111111106',
    true,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Sold uses is_won only (same convention as Life Placed / Paid).
-- Closed / Lost uses is_lost + is_terminal.
-- Fulfillment after Sold is out of scope.
SELECT public._seed_pipeline_stages(
  '22222222-2222-2222-2222-222222222215',
  '[
    {"id":"33333333-3333-3333-3333-333333333501","name":"Identified","code":"identified","sort_order":1},
    {"id":"33333333-3333-3333-3333-333333333502","name":"Consultation","code":"consultation","sort_order":2},
    {"id":"33333333-3333-3333-3333-333333333503","name":"Presented","code":"presented","sort_order":3},
    {"id":"33333333-3333-3333-3333-333333333504","name":"Sold","code":"sold","sort_order":4,"is_won":true},
    {"id":"33333333-3333-3333-3333-333333333505","name":"Closed / Lost","code":"closed_lost","sort_order":5,"is_lost":true,"is_terminal":true}
  ]'::jsonb
);

SELECT public._seed_pipeline_stages(
  '22222222-2222-2222-2222-222222222216',
  '[
    {"id":"33333333-3333-3333-3333-333333333601","name":"Identified","code":"identified","sort_order":1},
    {"id":"33333333-3333-3333-3333-333333333602","name":"Consultation","code":"consultation","sort_order":2},
    {"id":"33333333-3333-3333-3333-333333333603","name":"Presented","code":"presented","sort_order":3},
    {"id":"33333333-3333-3333-3333-333333333604","name":"Sold","code":"sold","sort_order":4,"is_won":true},
    {"id":"33333333-3333-3333-3333-333333333605","name":"Closed / Lost","code":"closed_lost","sort_order":5,"is_lost":true,"is_terminal":true}
  ]'::jsonb
);
