# Migration 024 — authenticated CRM privileges + duplicate notes

**Status:** Authored as
`supabase/migrations/024_authenticated_crm_privileges_and_duplicate_notes_fix.sql`.

## Fixes

1. Minimum table GRANTs for `authenticated` (and additive `service_role` DML) so RLS policies can apply after `db reset`.
2. Remove `chr(0)` notes sanitization from `resolve_public_family_duplicate_review` (preserves 023 resolve-task behavior).

See verification: `scripts/sql/verify-024-authenticated-privileges-and-notes.sql`.
