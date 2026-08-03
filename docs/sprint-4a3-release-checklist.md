# Sprint 4A.3 — Release Candidate Deployment Guide

This document covers environment configuration and the production promote checklist for the
public Family Report Card → CRM Initial Financial Diagnostic stack (migrations **020–024**).

**Do not put real secrets in this file or in commits.**

---

## Environment contract

### Browser-safe (`VITE_*` / public)

These may appear in the Vite client bundle:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Public Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key (RLS enforced) |
| `VITE_SITE_NAME` | Optional display name |
| `VITE_CALENDLY_REPORT_CARD_URL` | Optional scheduling URL |

**Never** set `VITE_SUPABASE_SERVICE_ROLE_KEY` or any service-role value under a `VITE_` prefix.

### Server-only (Vercel / Node API — no `VITE_` prefix)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Server Supabase URL (may match public URL) |
| `SUPABASE_ANON_KEY` | Anon key for middleware/session helpers |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** for `/api/ingest-family-report-card` admin client |
| `GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL` | Optional Family secondary Sheets webhook (server ingest) |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Other legacy/browser Sheets paths (non-Family) |
| `LEAD_NOTIFICATION_EMAIL` | Operational contact email (not a secret) |

`createSupabaseAdminClient()` (`lib/supabase/admin.ts`) refuses to start if:

- it is imported in a browser context
- `VITE_SUPABASE_SERVICE_ROLE_KEY` is set
- the key looks like an anon/publishable key

Missing service-role at runtime → Family CRM ingest returns a safe failure; the visitor stays on the assessment (no results navigation).

---

## Failure semantics (product contract)

1. **CRM persistence failure** → blocks navigation to `/results`. Visitor stays on the final step with a safe retry.
2. **Task automation failure** → does **not** block the public diagnostic. Visitor is not shown internal task errors. Lead may show `task_failed` / “needs attention” in CRM Intake.
3. **Google Sheets failure** → does **not** block the public diagnostic. CRM remains authoritative; Intake may show Sheets sync issue.
4. Task and Sheets outcomes remain visible **internally** (Intake / lead fields), not as alarming public visitor errors.

---

## Remote migration order

Apply exactly in order on the remote project (after prior migrations through 019):

1. `020_public_family_diagnostic_ingest.sql`
2. `021_public_family_duplicate_resolution.sql`
3. `022_public_family_task_automation.sql`
4. `023_confirm_same_allows_ingest_resolve_task.sql`

Local verification:

```bash
npx supabase db reset
```

---

## Vercel assumptions

- `api/ingest-family-report-card.ts` is a Vercel serverless function (`@vercel/node`).
- `vercel.json` rewrites `/api/*` to API handlers and SPA fallback for the rest.
- Configure **server** env vars in the Vercel project (Production + Preview). Do not rely on client `VITE_*` for the service role.
- Preview and Production should both have `SUPABASE_SERVICE_ROLE_KEY` when Family CRM ingest is tested.

---

## Release blockers (remaining)

1. **Privacy Policy legal review** of `/privacy` (page exists; not attorney-approved).

Migrations **023–024** are authored locally — apply remotely with **020 → 021 → 022 → 023 → 024**.

---

## Release checklist

1. [ ] Privacy Policy legal review of `/privacy` (page exists; not attorney-approved until reviewed)
2. [ ] Configure Vercel server variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, optional `GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL`)
3. [ ] Apply migrations **020 → 021 → 022 → 023 → 024** in order on the remote database
4. [ ] Deploy preview
5. [ ] Verify browser-safe Supabase configuration (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
6. [ ] Run public Family submission QA
7. [ ] Run Intake QA (owner + advisor)
8. [ ] Run duplicate-resolution QA (confirm-same with open resolve task must succeed)
9. [ ] Run task automation QA (including manual reconciliation)
10. [ ] Scan browser bundle for secrets (`SUPABASE_SERVICE_ROLE_KEY`, admin client, JWT-like values)
11. [ ] Promote to production

---

## Related docs

- `.env.example` — variable templates (no real secrets)
- `supabase/README.md` — migrations 020–023 details
- `docs/proposed-migration-023-confirm-same-resolve-task.md` — migration 023 notes
- `scripts/README-dev-auth.md` — safe owner/advisor auth bootstrap
- `scripts/sql/qa-sprint-4a3/README.md` — local CRM scenario seed
- `scripts/sql/verify-023-confirm-same-resolve-task-defect.sql` — confirm-same task-count proof
