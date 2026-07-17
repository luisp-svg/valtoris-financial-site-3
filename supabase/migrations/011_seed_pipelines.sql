-- 011_seed_pipelines.sql
-- Seed service verticals, relationship pipeline, and four service pipelines.
-- Idempotent via fixed UUIDs and ON CONFLICT / existence checks.

-- Fixed UUIDs for stable references across environments (not secrets).
-- Verticals
-- 11111111-1111-1111-1111-111111111101 life
-- 11111111-1111-1111-1111-111111111102 pc
-- 11111111-1111-1111-1111-111111111103 retirement
-- 11111111-1111-1111-1111-111111111104 wills_trusts
-- Pipelines
-- 22222222-2222-2222-2222-222222222201 relationship
-- 22222222-2222-2222-2222-222222222211 life
-- 22222222-2222-2222-2222-222222222212 pc
-- 22222222-2222-2222-2222-222222222213 retirement
-- 22222222-2222-2222-2222-222222222214 wills_trusts

INSERT INTO public.service_verticals (id, code, name, description, is_active, sort_order)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'life', 'Life Insurance', 'Life insurance planning and placement', true, 1),
  ('11111111-1111-1111-1111-111111111102', 'pc', 'Property & Casualty', 'Home, auto, and related P&C coverage', true, 2),
  ('11111111-1111-1111-1111-111111111103', 'retirement', 'Retirement', 'Retirement income and accumulation planning', true, 3),
  ('11111111-1111-1111-1111-111111111104', 'wills_trusts', 'Wills & Trusts', 'Estate documents and trust planning', true, 4)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Ensure fixed ids if rows already existed by code with different ids
-- (skip destructive remaps; seeds assume fresh or code-unique environment)

INSERT INTO public.pipelines (id, name, pipeline_type, service_vertical_id, is_default, is_active)
VALUES
  ('22222222-2222-2222-2222-222222222201', 'Relationship Pipeline', 'relationship', NULL, true, true),
  (
    '22222222-2222-2222-2222-222222222211',
    'Life Insurance Pipeline',
    'service',
    '11111111-1111-1111-1111-111111111101',
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222212',
    'Property & Casualty Pipeline',
    'service',
    '11111111-1111-1111-1111-111111111102',
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222213',
    'Retirement Pipeline',
    'service',
    '11111111-1111-1111-1111-111111111103',
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222214',
    'Wills & Trusts Pipeline',
    'service',
    '11111111-1111-1111-1111-111111111104',
    true,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Helper to upsert stages for a pipeline
CREATE OR REPLACE FUNCTION public._seed_pipeline_stages(
  p_pipeline_id uuid,
  p_stages jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  r jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    INSERT INTO public.pipeline_stages (
      id, pipeline_id, name, code, sort_order, is_won, is_lost, is_terminal
    )
    VALUES (
      (r ->> 'id')::uuid,
      p_pipeline_id,
      r ->> 'name',
      r ->> 'code',
      (r ->> 'sort_order')::integer,
      COALESCE((r ->> 'is_won')::boolean, false),
      COALESCE((r ->> 'is_lost')::boolean, false),
      COALESCE((r ->> 'is_terminal')::boolean, false)
    )
    ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      code = EXCLUDED.code,
      sort_order = EXCLUDED.sort_order,
      is_won = EXCLUDED.is_won,
      is_lost = EXCLUDED.is_lost,
      is_terminal = EXCLUDED.is_terminal,
      updated_at = now();
  END LOOP;
END;
$$;

-- Relationship stages
SELECT public._seed_pipeline_stages(
  '22222222-2222-2222-2222-222222222201',
  '[
    {"id":"33333333-3333-3333-3333-333333333001","name":"New Lead","code":"new_lead","sort_order":1},
    {"id":"33333333-3333-3333-3333-333333333002","name":"Attempting Contact","code":"attempting_contact","sort_order":2},
    {"id":"33333333-3333-3333-3333-333333333003","name":"Contacted","code":"contacted","sort_order":3},
    {"id":"33333333-3333-3333-3333-333333333004","name":"Assessment Completed","code":"assessment_completed","sort_order":4},
    {"id":"33333333-3333-3333-3333-333333333005","name":"Strategy Session Scheduled","code":"strategy_session_scheduled","sort_order":5},
    {"id":"33333333-3333-3333-3333-333333333006","name":"Strategy Session Completed","code":"strategy_session_completed","sort_order":6},
    {"id":"33333333-3333-3333-3333-333333333007","name":"Active Prospect","code":"active_prospect","sort_order":7},
    {"id":"33333333-3333-3333-3333-333333333008","name":"Client","code":"client","sort_order":8},
    {"id":"33333333-3333-3333-3333-333333333009","name":"Annual Review","code":"annual_review","sort_order":9},
    {"id":"33333333-3333-3333-3333-333333333010","name":"Inactive","code":"inactive","sort_order":10,"is_terminal":true},
    {"id":"33333333-3333-3333-3333-333333333011","name":"Lost","code":"lost","sort_order":11,"is_lost":true,"is_terminal":true}
  ]'::jsonb
);

-- Life Insurance
SELECT public._seed_pipeline_stages(
  '22222222-2222-2222-2222-222222222211',
  '[
    {"id":"33333333-3333-3333-3333-333333333101","name":"Opportunity Identified","code":"opportunity_identified","sort_order":1},
    {"id":"33333333-3333-3333-3333-333333333102","name":"Fact Finder","code":"fact_finder","sort_order":2},
    {"id":"33333333-3333-3333-3333-333333333103","name":"Recommendation Presented","code":"recommendation_presented","sort_order":3},
    {"id":"33333333-3333-3333-3333-333333333104","name":"Application Started","code":"application_started","sort_order":4},
    {"id":"33333333-3333-3333-3333-333333333105","name":"Submitted","code":"submitted","sort_order":5},
    {"id":"33333333-3333-3333-3333-333333333106","name":"Underwriting","code":"underwriting","sort_order":6},
    {"id":"33333333-3333-3333-3333-333333333107","name":"Approved","code":"approved","sort_order":7},
    {"id":"33333333-3333-3333-3333-333333333108","name":"Placed / Paid","code":"placed_paid","sort_order":8,"is_won":true},
    {"id":"33333333-3333-3333-3333-333333333109","name":"Annual Review","code":"annual_review","sort_order":9},
    {"id":"33333333-3333-3333-3333-333333333110","name":"Closed / Lost","code":"closed_lost","sort_order":10,"is_lost":true,"is_terminal":true}
  ]'::jsonb
);

-- P&C
SELECT public._seed_pipeline_stages(
  '22222222-2222-2222-2222-222222222212',
  '[
    {"id":"33333333-3333-3333-3333-333333333201","name":"Opportunity Identified","code":"opportunity_identified","sort_order":1},
    {"id":"33333333-3333-3333-3333-333333333202","name":"Information Needed","code":"information_needed","sort_order":2},
    {"id":"33333333-3333-3333-3333-333333333203","name":"Quote Requested","code":"quote_requested","sort_order":3},
    {"id":"33333333-3333-3333-3333-333333333204","name":"Quote Presented","code":"quote_presented","sort_order":4},
    {"id":"33333333-3333-3333-3333-333333333205","name":"Bound","code":"bound","sort_order":5,"is_won":true},
    {"id":"33333333-3333-3333-3333-333333333206","name":"Renewal Review","code":"renewal_review","sort_order":6},
    {"id":"33333333-3333-3333-3333-333333333207","name":"Closed / Lost","code":"closed_lost","sort_order":7,"is_lost":true,"is_terminal":true}
  ]'::jsonb
);

-- Retirement
SELECT public._seed_pipeline_stages(
  '22222222-2222-2222-2222-222222222213',
  '[
    {"id":"33333333-3333-3333-3333-333333333301","name":"Opportunity Identified","code":"opportunity_identified","sort_order":1},
    {"id":"33333333-3333-3333-3333-333333333302","name":"Retirement Assessment","code":"retirement_assessment","sort_order":2},
    {"id":"33333333-3333-3333-3333-333333333303","name":"Strategy Session","code":"strategy_session","sort_order":3},
    {"id":"33333333-3333-3333-3333-333333333304","name":"Recommendation Review","code":"recommendation_review","sort_order":4},
    {"id":"33333333-3333-3333-3333-333333333305","name":"Application / Transfer","code":"application_transfer","sort_order":5},
    {"id":"33333333-3333-3333-3333-333333333306","name":"Processing","code":"processing","sort_order":6},
    {"id":"33333333-3333-3333-3333-333333333307","name":"Funded","code":"funded","sort_order":7,"is_won":true},
    {"id":"33333333-3333-3333-3333-333333333308","name":"Annual Review","code":"annual_review","sort_order":8},
    {"id":"33333333-3333-3333-3333-333333333309","name":"Closed / Lost","code":"closed_lost","sort_order":9,"is_lost":true,"is_terminal":true}
  ]'::jsonb
);

-- Wills & Trusts
SELECT public._seed_pipeline_stages(
  '22222222-2222-2222-2222-222222222214',
  '[
    {"id":"33333333-3333-3333-3333-333333333401","name":"Opportunity Identified","code":"opportunity_identified","sort_order":1},
    {"id":"33333333-3333-3333-3333-333333333402","name":"Consultation Scheduled","code":"consultation_scheduled","sort_order":2},
    {"id":"33333333-3333-3333-3333-333333333403","name":"Intake Started","code":"intake_started","sort_order":3},
    {"id":"33333333-3333-3333-3333-333333333404","name":"Documents Needed","code":"documents_needed","sort_order":4},
    {"id":"33333333-3333-3333-3333-333333333405","name":"Drafting","code":"drafting","sort_order":5},
    {"id":"33333333-3333-3333-3333-333333333406","name":"Client Review","code":"client_review","sort_order":6},
    {"id":"33333333-3333-3333-3333-333333333407","name":"Completed","code":"completed","sort_order":7,"is_won":true},
    {"id":"33333333-3333-3333-3333-333333333408","name":"Closed / Lost","code":"closed_lost","sort_order":8,"is_lost":true,"is_terminal":true}
  ]'::jsonb
);

-- Drop helper after seed (optional keep for re-runs — keep for idempotent re-apply)
COMMENT ON FUNCTION public._seed_pipeline_stages(uuid, jsonb) IS
  'Internal seed helper for pipeline stages. Safe to re-run. Not a public API.';

REVOKE ALL ON FUNCTION public._seed_pipeline_stages(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._seed_pipeline_stages(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._seed_pipeline_stages(uuid, jsonb) FROM authenticated;
