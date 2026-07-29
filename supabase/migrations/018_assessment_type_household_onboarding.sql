-- 018_assessment_type_household_onboarding.sql
-- Additive assessment_type value for CRM Household Onboarding.
-- Kept separate from lifecycle/schema changes so the new enum value is committed
-- before it is referenced (PostgreSQL requirement).

ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'household_onboarding';

COMMENT ON TYPE public.assessment_type IS
  'Assessment product type. family/business/retirement/protection are public report-card flows; household_onboarding is CRM guided evidence capture.';
