-- 015_member_relationship_enum_values.sql
-- Additive CRM-6 relationship values for household_members.relationship.
-- Does not remove or rename existing values (primary, spouse, partner, child, dependent, other).

ALTER TYPE public.member_relationship ADD VALUE IF NOT EXISTS 'parent';
ALTER TYPE public.member_relationship ADD VALUE IF NOT EXISTS 'grandparent';
ALTER TYPE public.member_relationship ADD VALUE IF NOT EXISTS 'business_partner';
ALTER TYPE public.member_relationship ADD VALUE IF NOT EXISTS 'employee';

COMMENT ON TYPE public.member_relationship IS
  'Household member relationship. CRM-6 UI labels: primary=Self; partner/dependent retained for legacy rows.';
