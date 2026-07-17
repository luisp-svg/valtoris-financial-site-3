-- 008_policies_appointments_reviews.sql
-- Insurance policies (insured vs owner), appointments, annual reviews.

-- ---------------------------------------------------------------------------
-- policies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.policies (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  -- Person covered by the policy
  insured_member_id uuid REFERENCES public.household_members (id) ON DELETE SET NULL,
  -- Legal/policy owner (may differ from insured)
  policy_owner_member_id uuid REFERENCES public.household_members (id) ON DELETE SET NULL,
  -- Use when owner is an outside person/entity not in household_members
  policy_owner_name text,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE SET NULL,
  servicing_advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  carrier text NOT NULL,
  policy_type text NOT NULL,
  policy_number text,
  coverage_amount numeric(14, 2),
  premium numeric(14, 2),
  payment_frequency text,
  payment_date date,
  effective_date date,
  renewal_or_review_date date,
  beneficiary text,
  status text NOT NULL DEFAULT 'pending',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS policies_household_idx
  ON public.policies (household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS policies_servicing_advisor_idx
  ON public.policies (servicing_advisor_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS policies_renewal_idx
  ON public.policies (renewal_or_review_date)
  WHERE deleted_at IS NULL AND renewal_or_review_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS policies_insured_member_idx
  ON public.policies (insured_member_id)
  WHERE insured_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS policies_owner_member_idx
  ON public.policies (policy_owner_member_id)
  WHERE policy_owner_member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS policies_carrier_number_unique_idx
  ON public.policies (carrier, policy_number)
  WHERE policy_number IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS policies_set_updated_at ON public.policies;
CREATE TRIGGER policies_set_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.policies IS
  'In-force/pending policies. insured_member_id and policy_owner_member_id may differ.';
COMMENT ON COLUMN public.policies.insured_member_id IS
  'Household member who is the insured life/property subject.';
COMMENT ON COLUMN public.policies.policy_owner_member_id IS
  'Household member who owns the policy when different from insured (e.g. parent/spouse/business owner).';
COMMENT ON COLUMN public.policies.policy_owner_name IS
  'Free-text owner when outside the household (entity or non-member). Does not replace insured_member_id.';
COMMENT ON COLUMN public.policies.details IS
  'Riders and product-specific fields.';

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE SET NULL,
  advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  location_or_url text,
  external_calendly_event_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS appointments_advisor_starts_idx
  ON public.appointments (advisor_id, starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS appointments_household_starts_idx
  ON public.appointments (household_id, starts_at)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- annual_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.annual_reviews (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.advisor_profiles (id) ON DELETE SET NULL,
  scheduled_for date,
  completed_at date,
  summary text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS annual_reviews_household_idx
  ON public.annual_reviews (household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS annual_reviews_scheduled_idx
  ON public.annual_reviews (scheduled_for)
  WHERE deleted_at IS NULL AND scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS annual_reviews_advisor_idx
  ON public.annual_reviews (advisor_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS annual_reviews_set_updated_at ON public.annual_reviews;
CREATE TRIGGER annual_reviews_set_updated_at
  BEFORE UPDATE ON public.annual_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.annual_reviews.checklist IS
  'Flexible verticals/topics reviewed during the annual review.';
