-- Approved Life Insurance planning intake, separate from diagnostic and production records.
ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'life_insurance_intake';
