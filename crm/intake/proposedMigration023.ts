/**
 * Migration 023 — confirm-same allows the ingest resolve task.
 */
export const PROPOSED_MIGRATION_023_FILENAME =
  '023_confirm_same_allows_ingest_resolve_task.sql' as const

/** Historical pre-approval flag — migration file is now present. */
export const PROPOSED_MIGRATION_023_REQUIRED = false as const

export const MIGRATION_023_CONTRACT_MARKERS = [
  'resolve_public_family_duplicate_review',
  'resolve_possible_duplicate',
  'CRM_DUP:unsafe_dependents',
  "source_type IN ('public_family_ingest', 'duplicate_resolution', 'system')",
] as const
