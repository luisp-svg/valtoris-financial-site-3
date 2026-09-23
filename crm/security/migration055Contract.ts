/** Static contract markers for Migration 055 integration contact links. */

export const MIGRATION_055_FILENAME = '055_integration_contact_links.sql'

export const MIGRATION_055_TABLE = 'integration_contact_links'

export const MIGRATION_055_COLUMNS = [
  'id',
  'provider',
  'location_id',
  'external_contact_id',
  'household_member_id',
  'created_at',
  'updated_at',
] as const

export const MIGRATION_055_FORBIDDEN_COLUMNS = [
  'sync_status',
  'last_error_category',
  'last_attempted_at',
  'last_lead_id',
  'retry_count',
  'payload',
  'phone',
  'email',
  'first_name',
  'last_name',
  'name',
  'token',
  'credential',
  'secret',
] as const

export const MIGRATION_055_CONTRACT_MARKERS = [
  'CREATE TABLE IF NOT EXISTS public.integration_contact_links',
  'id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()',
  'provider text NOT NULL',
  'location_id text NOT NULL',
  'external_contact_id text NOT NULL',
  'household_member_id uuid NOT NULL REFERENCES public.household_members (id) ON DELETE RESTRICT',
  'created_at timestamptz NOT NULL DEFAULT now()',
  'updated_at timestamptz NOT NULL DEFAULT now()',
  'CONSTRAINT integration_contact_links_contact_unique',
  'UNIQUE (provider, location_id, external_contact_id)',
  'CONSTRAINT integration_contact_links_member_unique',
  'UNIQUE (provider, location_id, household_member_id)',
  'EXECUTE FUNCTION public.set_updated_at()',
  'ALTER TABLE public.integration_contact_links ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE public.integration_contact_links FORCE ROW LEVEL SECURITY',
  'CREATE POLICY integration_contact_links_select ON public.integration_contact_links',
  'FOR SELECT TO authenticated',
  'public.crm_can_access_household(m.household_id)',
  'm.deleted_at IS NULL',
  'REVOKE ALL ON TABLE public.integration_contact_links FROM PUBLIC',
  'REVOKE ALL ON TABLE public.integration_contact_links FROM anon',
  'REVOKE ALL ON TABLE public.integration_contact_links FROM authenticated',
  'GRANT SELECT ON TABLE public.integration_contact_links TO authenticated',
  'REVOKE INSERT, UPDATE, DELETE ON TABLE public.integration_contact_links FROM authenticated',
  'GRANT ALL ON TABLE public.integration_contact_links TO service_role',
] as const

export const MIGRATION_055_FORBIDDEN_MARKERS = [
  'CREATE TYPE',
  'AS ENUM',
  'ON DELETE CASCADE',
  'FOR INSERT',
  'FOR UPDATE',
  'FOR DELETE',
  'FOR ALL',
  'TO anon',
  'GRANT INSERT',
  'GRANT UPDATE',
  'GRANT DELETE',
  'agentcrm',
  'sync_status',
  'last_error_category',
  'last_attempted_at',
  'last_lead_id',
  'retry_count',
] as const
