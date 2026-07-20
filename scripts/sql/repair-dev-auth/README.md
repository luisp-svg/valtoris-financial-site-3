# Staged repair: malformed dry-run Auth users (valtoris-crm-dev)

**Status:** Reviewed plan only. **Do not apply** until each phase is explicitly approved.  
**Project:** `cxgiaevervjttbuiramd` (`cxgiaevervjttbuiramd.supabase.co`)  
**No Admin API + SQL atomicity:** each phase is a separate checkpoint. Never assume a SQL transaction undoes Admin `createUser`.

## Safety review of the previous monolithic SQL

| Issue | Severity | Resolution in this staged plan |
|--------|----------|--------------------------------|
| Assumed Admin createUser + SQL remap + auth delete were one flow | Critical | Split into Phases B → C → D → E with durable map + ROLLBACK defaults |
| Deleted `auth.users` inside the same SQL txn as public remap | Critical | Phase E only after Phase D proves zero public refs |
| No expected-count / advisor-id guards from diagnose | High | Phase A aborts on mismatch |
| No project-ref latch in SQL | High | Phase A/B/D/E check `current_setting` / explicit constants |
| Remapped `audit_logs.actor_user_id` without audit-model review | High | Default Phase D does **not** mutate audit actors (see below) |
| Relied on Admin `updateUserById` while getUserById returns 500 | High | Phase B free emails via SQL on the three exact UUIDs only |

## Confirmed diagnosis baseline (2026-07-17)

| Placeholder UUID | Email | Role |
|------------------|-------|------|
| `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1` | `owner.dev@valtoris.test` | `owner` |
| `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2` | `advisor.a@valtoris.test` | `advisor` |
| `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3` | `advisor.b@valtoris.test` | `advisor` |

| Advisor profile id | user_id | slug |
|--------------------|---------|------|
| `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1` | aaa…aaa1 | `dev-owner` |
| `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2` | aaa…aaa2 | `advisor-a` |
| `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3` | aaa…aaa3 | `advisor-b` |

Expected public reference counts (must match Phase A or abort):

| Ref | old UUID | n |
|-----|----------|---|
| `profiles.id` | aaa1, aaa2, aaa3 | 1 each |
| `advisor_profiles.user_id` | aaa1, aaa2, aaa3 | 1 each |
| `audit_logs.actor_user_id` | aaa1 | 5 |
| `audit_logs.actor_user_id` | aaa3 | 18 |
| `households.assigned_by_user_id` | aaa1 | 2 |
| `recommendations.reviewed_by_user_id` | aaa3 | 1 |
| `opportunities.assigned_by_user_id` | aaa3 | 1 |
| `advisor_assignments.assigned_by_user_id` | aaa1 | 3 |
| `activities.actor_user_id` | aaa1 | 1 |
| `activities.actor_user_id` | aaa3 | 3 |

All other scanned public FK columns: **0**. Hit groups: **14**.

Auth Admin: all three `getUserById(placeholder)` → **MALFORMED/500**.

## Audit model (`audit_logs`)

Schema comment: *“Security/compliance audit trail. Append-only; not a user-facing timeline.”*  
FK: `actor_user_id … ON DELETE SET NULL`.

**Verdict:** Updating `actor_user_id` **violates the append-only audit model** (it rewrites history).  

**Safest default for this repair:**
1. Do **not** `UPDATE audit_logs.actor_user_id`.
2. In Phase D, `INSERT` append-only audit rows documenting the identity remap (old→new).
3. When old profiles are removed, existing rows’ `actor_user_id` become `NULL` via FK (attribution lost in the column; remap event remains).

**Optional (dry-run only, opt-in):** `phase-d-optional-audit-actor-remap.sql` rewrites actors for continuity. Do not use that pattern in production compliance environments.

## Auth schema tables involved (Phase B / E)

Typical Supabase Auth tables that may reference these users (inspect only the three UUIDs):

| Table | Role in repair |
|-------|----------------|
| `auth.users` | Primary identity row (malformed) |
| `auth.identities` | Email provider identity; `identity_data.email` / `provider_id` often hold email |
| `auth.sessions` | May exist; delete with user if present |
| `auth.refresh_tokens` | May exist; delete with user if present |
| `auth.mfa_factors` | Usually empty for dry-run |
| `auth.one_time_tokens` | Usually empty |
| `auth.flow_state` | Usually unrelated |

**Do not** print `encrypted_password`, tokens, or secrets. Select only `id`, `email`, `provider`, timestamps, and non-secret identity email fields.

Delete order (Phase E, exact UUIDs only): child auth rows → `auth.identities` → `auth.users` (or Admin `deleteUser` if it ever becomes usable). Public FKs must already be zero.

## Phases

| Phase | Artifact | Writes? | Default |
|-------|----------|---------|---------|
| A | `phase-a-verify.sql` | Yes (crm_repair schema/map/helper only) | Transaction; **initial-state only** (original emails; `new_id` must be null) |
| B | `phase-b-neutralize-auth.sql` | Yes (auth + profile emails) | **ROLLBACK** |
| C | `phase-c-create-users.mjs` | Yes (Admin createUser) | Idempotent; records map |
| D | `phase-d-remap-public.sql` | Yes (public CRM) | **ROLLBACK** |
| E | `phase-e-delete-auth.sql` | Yes (auth cleanup) | **ROLLBACK** |
| Z | `phase-z-cleanup-artifacts.sql` | Yes (drop repair artifacts) | **ROLLBACK** |

Durable checkpoint: `crm_repair._dev_auth_repair_map` (RLS forced; revoked from anon/authenticated)  
Helper: `crm_repair.assert_ref_count` (exact table.column pairs; fixed search_path)  
Local map file from Phase C: `.dev-auth-remap.json` (gitignored)  
Cleanup after full repair: `phase-z-cleanup-artifacts.sql` (default `ROLLBACK`)

## Rollback / recovery per phase

| Phase | If something goes wrong |
|-------|-------------------------|
| A | Transaction rolls back on mismatch. Initial-state only — do not re-run after Phase B. |
| B | Leave final `ROLLBACK`. If you `COMMIT` by mistake: emails are archived to unique `dev-archive-…@valtoris.test` values — reverse by restoring original emails **only** for the three exact UUIDs (do not invent new Auth rows). |
| C | Admin users may exist. Re-run Phase C (idempotent by email). Do not delete them unless Phase D never started. Map file / `_dev_auth_repair_map.new_id` records UUIDs. |
| D | Default `ROLLBACK` undoes public remap. If committed incorrectly: restore from backup/PITR — do not hand-edit. |
| E | Default `ROLLBACK`. If committed: Auth placeholders are gone; public should already be remapped. Do not recreate placeholder UUIDs. |

## Exact next read-only command

```bash
npm run bootstrap:dev-auth:diagnose
```

Then run **Phase A** in the Supabase SQL editor for `cxgiaevervjttbuiramd` (set the manual confirm flag to `true` first).

## Execution order (when approved later)

1. Phase A (SQL)  
2. Phase B (SQL) — review, then `COMMIT` only when approved  
3. Phase C (Node Admin API)  
4. Phase D (SQL) — fill `new_id` from Phase C, review, then `COMMIT`  
5. Phase E (SQL) — only if Phase D verification shows zero public refs  
6. Optional: `npm run bootstrap:dev-auth` to set passwords if Phase C used temporary passwords  

**Never** run the old monolithic `scripts/sql/repair-dev-placeholder-auth.sql` (replaced by this folder; file retained as a pointer stub).
