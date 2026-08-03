/**
 * Migration 024 — authenticated CRM privileges + duplicate notes fix.
 */
export const PROPOSED_MIGRATION_024_FILENAME =
  '024_authenticated_crm_privileges_and_duplicate_notes_fix.sql' as const

/** Historical pre-approval flag — migration file is now present. */
export const PROPOSED_MIGRATION_024_REQUIRED = false as const

export const MIGRATION_024_CONTRACT_MARKERS = [
  'GRANT SELECT, INSERT, UPDATE ON TABLE public.leads TO authenticated',
  'GRANT SELECT, INSERT, UPDATE ON TABLE public.households TO authenticated',
  'REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE',
  'FROM anon',
  'Do NOT use chr(0)',
  'resolve_public_family_duplicate_review',
  'TO service_role',
] as const
