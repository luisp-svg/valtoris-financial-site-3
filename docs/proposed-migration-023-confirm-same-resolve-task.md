# Migration 023 — confirm-same vs resolve task

**Status:** Approved and authored as
`supabase/migrations/023_confirm_same_allows_ingest_resolve_task.sql`.

## Defect (resolved)

After migration **022**, possible-match ingest creates an open
`resolve_possible_duplicate` task on the provisional household.

Migration **021** `confirm_same_household` treated **any** non-deleted task as an
unsafe dependent, blocking confirm-same for the real possible-match path.

## Minimal fix applied

1. Exclude the expected automatic resolve task from `v_task_count`.
2. Complete matching open resolve tasks after successful `keep_separate` /
   `confirm_same_household` (no soft-delete; history retained).

Other unsafe dependents (extra assessments, notes, manual tasks, etc.) still block.

## Verification

```bash
npx supabase db reset
# optional: seed + scripts/sql/verify-023-confirm-same-resolve-task-defect.sql
```
