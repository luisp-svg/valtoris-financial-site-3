/** Static contract markers for Migration 030 Activity INSERT revoke. */

export const MIGRATION_030_FILENAME =
  '030_revoke_authenticated_activity_inserts.sql'

export const MIGRATION_030_CONTRACT_MARKERS = [
  'DROP POLICY IF EXISTS activities_insert ON public.activities',
  'REVOKE ALL ON TABLE public.activities FROM PUBLIC',
  'REVOKE ALL ON TABLE public.activities FROM anon',
  'REVOKE ALL ON TABLE public.activities FROM authenticated',
  'GRANT SELECT ON TABLE public.activities TO authenticated',
  'GRANT ALL ON TABLE public.activities TO service_role',
  'GRANT EXECUTE ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid)',
  'FROM PUBLIC, anon',
  'activities_select remains',
] as const

export const MIGRATION_030_FORBIDDEN_MARKERS = [
  'Task Completion',
  'complete_task',
  'CREATE TABLE public.cases',
  'GRANT SELECT, INSERT ON TABLE public.activities TO authenticated',
  'GRANT INSERT ON TABLE public.activities TO authenticated',
  'GRANT UPDATE ON TABLE public.activities TO authenticated',
  'GRANT DELETE ON TABLE public.activities TO authenticated',
  'DROP POLICY IF EXISTS activities_select',
  'quick_add_contact',
  '032_',
] as const

/** Final Activity table privileges after Migration 030. */
export const MIGRATION_030_FINAL_ACTIVITY_GRANTS = {
  public: [] as const,
  anon: [] as const,
  authenticated: ['SELECT'] as const,
  service_role: 'ALL' as const,
} as const
