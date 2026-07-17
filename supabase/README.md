# Valtoris CRM — Supabase Database

SQL migrations for the Valtoris Advisor CRM / back office.

**Status:** Migrations `001`–`014` are authored for the development project `valtoris-crm-dev`.  
No production credentials are stored in this repository. Do not commit secrets.

---

## What this folder contains

```
supabase/
  README.md                 ← this file
  migrations/
    001_extensions_and_enums.sql
    002_profiles_roles_settings_audit.sql
    003_verticals_pipelines_stages.sql
    004_referral_sources_households_members_duplicates.sql
    005_leads_assessments_recommendations.sql
    006_opportunities_assignments.sql
    007_tasks_notes_activities.sql
    008_policies_appointments_reviews.sql
    009_documents_portal.sql
    010_rls_policies.sql
    011_seed_pipelines.sql
    012_secure_rpcs.sql
    013_storage_policies.sql
    014_security_hardening.sql
```

---

## Final migration order (dependency-safe)

Apply **in this exact order**:

| # | File | Purpose |
|---|------|---------|
| 001 | `001_extensions_and_enums.sql` | `pgcrypto`, `citext`, enums, `set_updated_at` |
| 002 | `002_profiles_roles_settings_audit.sql` | `profiles`, `advisor_profiles`, `app_settings`, `audit_logs`, auth signup trigger |
| 003 | `003_verticals_pipelines_stages.sql` | `service_verticals`, `pipelines`, `pipeline_stages` |
| 004 | `004_referral_sources_households_members_duplicates.sql` | households, members, duplicates, attribution immutability |
| 005 | `005_leads_assessments_recommendations.sql` | leads, assessments, recommendations |
| 006 | `006_opportunities_assignments.sql` | opportunities, assignments, `service_needs_matrix` (security_invoker) |
| 007 | `007_tasks_notes_activities.sql` | tasks, notes, activities |
| 008 | `008_policies_appointments_reviews.sql` | policies (insured + owner), appointments, annual_reviews |
| 009 | `009_documents_portal.sql` | documents metadata, client_portal_accounts |
| 010 | `010_rls_policies.sql` | RLS helpers + policies; FORCE RLS; soft-delete filters |
| 011 | `011_seed_pipelines.sql` | Pipeline seed data |
| 012 | `012_secure_rpcs.sql` | Column guards + audited RPCs |
| 013 | `013_storage_policies.sql` | Private `crm-documents` bucket + storage.objects policies |
| 014 | `014_security_hardening.sql` | Clear RPC context after secure RPCs; strengthen profile column guard |

---

## FIRST OWNER BOOTSTRAP (mandatory)

Invited Auth users are created as **`advisor`** by `handle_new_auth_user` (role from client metadata is ignored).

Owner-only actions (creating `advisor_profiles`, assigning households, managing settings) **cannot** run until at least one profile has `role = 'owner'`.

An advisor **cannot** self-promote: RLS + triggers block `role` changes on self-update.

### Required one-time admin step

After the first invite accepts, promote that user in the **Supabase SQL Editor** (or any service-role/admin connection). This bypasses RLS as a privileged database role.

```sql
-- FIRST OWNER BOOTSTRAP (placeholder — replace the email)
UPDATE public.profiles
SET
  role = 'owner',
  full_name = 'YOUR OWNER NAME',
  updated_at = now()
WHERE email = 'owner@example.com'
  AND deleted_at IS NULL;

-- Verify
SELECT id, email, role, is_active
FROM public.profiles
WHERE email = 'owner@example.com';
```

Then create their advisor profile (if they also produce):

```sql
INSERT INTO public.advisor_profiles (user_id, display_name, slug)
SELECT id, 'YOUR OWNER NAME', 'owner-slug'
FROM public.profiles
WHERE email = 'owner@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

**Never put the Supabase service-role key in Vite/`VITE_*` variables or browser code.**  
There is **no** publicly callable bootstrap RPC by design.

---

## How to apply migrations

1. Create a Supabase project (Dashboard or CLI) — use a clearly named **dev** project first.
2. Install Supabase CLI (`supabase` is a repo devDependency).
3. `npx supabase link --project-ref <YOUR_PROJECT_REF>`
4. Prefer `npx supabase db push --linked`. If linked push hangs on login-role init, apply each file in order with `npx supabase db query --linked --file supabase/migrations/<file>.sql`, then repair remote history with `npx supabase migration repair --status applied <versions>` so the CLI does not re-run them.
5. Configure Auth as **invite-only** (disable public sign-ups).
6. Complete **FIRST OWNER BOOTSTRAP** above.
7. Smoke-test RLS and RPCs on the temporary project.

Never re-apply `001`–`013` to a database that already has those objects.

---

## Required Supabase project configuration

| Setting | Value |
|---------|--------|
| Database | Postgres (Supabase default) |
| Auth | Email invites; **disable** public sign-ups |
| Storage | Private bucket `crm-documents`, max **20 MB** (migration 013) |
| RLS | Enabled + FORCE on all CRM tables (migration 010) |
| Extensions | `pgcrypto`, `citext` in `extensions` schema (migration 001) |

### Required extensions

- `pgcrypto` — use `extensions.gen_random_uuid()` in defaults
- `citext` — case-insensitive emails

---

## Environment variables (placeholders only)

```bash
# Public (Vite client) — safe with RLS
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Server only (Vercel /api/ingest-lead) — NEVER expose to the browser
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co

# Dual-write during CRM validation
GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

# Optional ingest hardening
CRM_INGEST_HMAC_SECRET=YOUR_RANDOM_SECRET
```

### Security warning

**Never put `SUPABASE_SERVICE_ROLE_KEY` in any `VITE_*` variable, client bundle, or browser code.**  
The service role bypasses RLS.

---

## Storage policy assumptions (migration 013)

1. Migrator has rights to insert `storage.buckets` and create policies on `storage.objects`.
2. Application creates a `public.documents` row **before** uploading the file.
3. Object `name` (path) must equal `documents.storage_path`; `bucket_id` must equal `documents.storage_bucket` (`crm-documents`).
4. Prefer unguessable paths such as `{household_id}/{document_id}/{safe_filename}`.
5. Use **short-lived signed URLs** from a trusted server or authenticated client SDK; keep the bucket **non-public**.
6. Storage policies call `public.crm_is_owner()` / `public.crm_can_access_household()` — migration **010 must run before 013**.
7. `anon` has no storage policies → denied.

---

## Secure RPC model

Protected column changes require transaction-local context, set **only immediately before** protected writes:

```sql
PERFORM set_config('crm.rpc_context', 'assign_household', true);
-- protected UPDATE(s) + activity/audit
PERFORM public.crm_clear_rpc_context();  -- migration 014
```

**Why clear:** `set_config(..., true)` is transaction-local. Leaving the context set would let later statements in the same multi-statement transaction inherit the elevated context and bypass column guards. RPCs clear context themselves before returning; clients must not be responsible for clearing. On exception the whole transaction rolls back.

| Context | RPC | Allows |
|---------|-----|--------|
| `assign_household` | `assign_household` | Household + lead assignment fields |
| `move_household_stage` | `move_household_stage` | Relationship stage fields **and** `households.status` |
| `move_opportunity_stage` | `move_opportunity_stage` | Opportunity stage/status/closed_at |
| `convert_recommendation_to_opportunity` | `convert_recommendation_to_opportunity` | `status=converted`, `converted_opportunity_id`, initial opp assignment |
| `set_attribution` | (future ingest) | `original_*` field updates |
| `assign_opportunity` | (future) | Opportunity reassignment (owner-only when used) |
| `admin_set_household_status` | (future admin only) | Direct status override if ever required |

`assign_opportunity` is **not** implemented yet; the context name is reserved for a future owner-only RPC. Duplicate/merge household fields are **owner-only** (no advisor writes), without requiring an RPC.

### Profile self-service (migration 014)

Advisors may update **only their own** `full_name`, `phone`, and `avatar_url`. They cannot change `role`, `is_active`, `manager_id`, `settings`, `email`, soft-delete, or another user’s profile — even if an RLS policy is later broadened. Owners retain admin updates. Reserved roles remain default-deny via RLS **and** the profile column guard (`crm_is_advisor` required for self-service).

### Household status is synchronized from the relationship pipeline

`households.status` must **not** be edited independently in the CRM UI or via direct SQL from the app.

`move_household_stage` derives status from the destination stage’s **stable `code`** (never display names):

| Stage code | `household_status` |
|------------|--------------------|
| `new_lead` | `lead` |
| `attempting_contact` | `lead` |
| `contacted` | `prospect` |
| `assessment_completed` | `prospect` |
| `strategy_session_scheduled` | `prospect` |
| `strategy_session_completed` | `prospect` |
| `active_prospect` | `prospect` |
| `client` | `client` |
| `annual_review` | `client` |
| `inactive` | `inactive` |
| `lost` | `lost` |

Direct `UPDATE households SET status = …` is blocked by the column guard unless `crm.rpc_context` is `move_household_stage` (or a future approved `admin_set_household_status`).

---

## Functions executable by `authenticated`

- `crm_current_profile`, `crm_is_owner`, `crm_is_advisor`, `crm_advisor_id`
- `crm_advisors_can_view_unassigned`, `crm_can_access_household`, `crm_can_access_opportunity`
- `assign_household`, `move_household_stage`, `move_opportunity_stage`, `convert_recommendation_to_opportunity`

## Functions revoked from `authenticated` / `anon` / `PUBLIC`

- `crm_write_audit`, `crm_write_activity`
- `crm_rpc_context`, `crm_require_rpc_context`, `crm_clear_rpc_context`
- Column-guard trigger functions (`enforce_*`)
- `_seed_pipeline_stages`

---

## Opportunity hard-delete / recommendation cleanup

`recommendations.converted_opportunity_id` uses **`ON DELETE SET NULL`** toward `opportunities`.

Hard-deleting a converted opportunity can conflict with:

1. The recommendation conversion column guard (`enforce_recommendation_protected_columns`), which blocks clearing `converted_opportunity_id` / setting `status = converted` outside `convert_recommendation_to_opportunity` context.
2. The check constraint that requires a converted recommendation to keep a matching opportunity id when status is `converted`.

**Normal application workflows must soft-delete opportunities** (`deleted_at`), not `DELETE` them.

Hard cleanup is an **owner/admin maintenance procedure only** (privileged SQL session). When required:

1. Set `crm.rpc_context` to `convert_recommendation_to_opportunity` (or adjust recommendation status away from `converted` first under that context).
2. Soft-delete or re-link recommendations as appropriate.
3. Then remove or archive the opportunity.

**Do not delete `audit_logs` or `activities`.** There is no public cleanup RPC in V1.

---

## Approved product decisions (encoded)

- Supabase Postgres + Auth + Storage + RLS; CRM under `/crm` (routes not added yet)
- V1 roles: `owner`, `advisor` (enum reserves `manager`, `operations`, `client`)
- Sheets dual-write during validation (app concern)
- Immutable original attribution; mutable assignment via audited RPC
- US-first E.164 normalization (app/ingest)
- Invite-only accounts; first owner via SQL bootstrap
- Unassigned pool default hidden from advisors
- No advisor self-claim; no auto recommendation→opportunity
- Advisors may view assignment history for currently assigned households
- Ingest host (future): Vercel `/api/ingest-lead`
- Storage: `crm-documents`, 20 MB

---

## Future household profile tabs (UI not built)

Overview · Assessments · Recommendations · Opportunities · Policies · Tasks · Documents · Timeline · Notes · Family Members · **Budget (deferred)**

---

## Rollback and backup

- Prefer forward-fix migrations once shared environments exist.
- Enable backups/PITR before production apply.
- Soft-delete preferred; hard DELETE is owner-only where allowed.
- Attribution columns are trigger-protected.

---

## Project checklist

- [x] SQL files under `supabase/migrations/` (`001`–`014`)
- [x] README updated (including FIRST OWNER BOOTSTRAP + cleanup notes)
- [x] Dev migrations applied on `valtoris-crm-dev` (dry-run approved)
- [x] Supabase CLI available as a devDependency
- [ ] CRM UI / routes — **NO**
- [ ] Public funnels modified — **NO**
- [ ] Credentials committed — **NO**
