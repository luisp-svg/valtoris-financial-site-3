-- Private post-contact/post-report intake; never replaces the student_loan report card.
-- Separate transaction so the new enum value is usable by the following migration.
ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'student_loan_intake';
