-- 002_profiles_roles_settings_audit.sql
-- Profiles (linked to auth.users), advisor profiles, app settings, audit logs.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email extensions.citext NOT NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'advisor',
  is_active boolean NOT NULL DEFAULT true,
  phone text,
  avatar_url text,
  manager_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT profiles_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS profiles_role_idx
  ON public.profiles (role)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS profiles_manager_id_idx
  ON public.profiles (manager_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS profiles_active_idx
  ON public.profiles (is_active)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.profiles IS
  'App user profile. id matches auth.users.id. V1 active roles: owner, advisor.';
COMMENT ON COLUMN public.profiles.settings IS
  'Per-user prefs/flags. Do not use for authorization; RLS uses role + assignment.';
COMMENT ON COLUMN public.profiles.role IS
  'Active V1: owner, advisor. Reserved: manager, operations, client.';

-- ---------------------------------------------------------------------------
-- advisor_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advisor_profiles (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  slug text NOT NULL,
  email extensions.citext,
  phone text,
  photo_url text,
  bio text,
  calendly_url text,
  states_licensed text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  accepts_new_leads boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT advisor_profiles_slug_unique UNIQUE (slug),
  CONSTRAINT advisor_profiles_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS advisor_profiles_accepts_leads_idx
  ON public.advisor_profiles (accepts_new_leads, is_active)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS advisor_profiles_set_updated_at ON public.advisor_profiles;
CREATE TRIGGER advisor_profiles_set_updated_at
  BEFORE UPDATE ON public.advisor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.advisor_profiles IS
  'Public/operational advisor identity. slug used for ?advisor= attribution.';

-- ---------------------------------------------------------------------------
-- app_settings (owner-controlled feature flags)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.app_settings IS
  'Owner-controlled CRM settings. Seed includes advisors_can_view_unassigned_pool=false.';

-- Default: advisors cannot view unassigned pool
INSERT INTO public.app_settings (key, value)
VALUES (
  'advisors_can_view_unassigned_pool',
  '{"enabled": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- audit_logs (append-oriented security log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON public.audit_logs (entity_table, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON public.audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action, created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Security/compliance audit trail. Append-only; not a user-facing timeline.';

-- ---------------------------------------------------------------------------
-- Optional: create profile row when auth user is created (invite-only ops).
-- Does not grant roles automatically beyond default advisor; owner must promote.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Always default to advisor. Never trust raw_user_meta_data.role (privilege escalation).
  -- Owner promotes users explicitly after invite.
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@placeholder.local'),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    'advisor'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Creates profiles row on auth.users insert as role=advisor. Invite-only Auth; owner promotes separately.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
