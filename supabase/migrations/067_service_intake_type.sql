-- Additional private service intake lifecycle, approved by Luis.
ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'service_intake';
