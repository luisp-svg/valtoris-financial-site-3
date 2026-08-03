# Sprint 4A.3 — Local CRM QA seed

Deterministic, **local-only** CRM scenario data for interactive QA after `npx supabase db reset`.

## Safety

- Synthetic names/emails only (`qa.*@example.test`)
- No passwords, tokens, production IDs, or real PII
- Does **not** insert `auth.users` rows (avoids Auth Admin 500s from malformed manual auth)
- All seeded household display names are prefixed with `[QA4A3]` for easy cleanup

## Prerequisites

```bash
npx supabase db reset
```

### Owner / advisor login (required for CRM UI)

**Hosted dev project:** use the supported bootstrap only — see `scripts/README-dev-auth.md`:

```bash
npm run bootstrap:dev-auth
```

| Email | Role |
|-------|------|
| `owner.dev@valtoris.test` | owner |
| `advisor.a@valtoris.test` | advisor |
| `advisor.b@valtoris.test` | advisor |

**Local Supabase:** `bootstrap:dev-auth` is locked to the hosted project. Prefer Auth signup via GoTrue
(`POST /auth/v1/signup` with the local anon key), then set `public.profiles.role` to `owner` /
`advisor` and ensure an `advisor_profiles` row for advisors. Do **not** hand-insert incomplete
`auth.users` rows.

**Fixed by migration 024:** after `db reset`, `authenticated` receives the minimum table privileges
required by existing RLS policies (see `024_authenticated_crm_privileges_and_duplicate_notes_fix.sql`).

The seed **optionally** attaches assignments when an `advisor_profiles` row with slug `advisor-a` exists; otherwise assigned scenarios stay unassigned and print a NOTICE.

## Apply seed

```bash
# Prefer local Supabase DB URL from `supabase status`
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f scripts/sql/qa-sprint-4a3/seed-crm-scenarios.sql
```

Or:

```bash
npx supabase db query --local -f scripts/sql/qa-sprint-4a3/seed-crm-scenarios.sql
```

(If `-f` is unsupported in your CLI version, use `psql` as above.)

## Cleanup

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f scripts/sql/qa-sprint-4a3/cleanup-crm-scenarios.sql
```

## Scenario reference

| ID | Scenario | Deterministic lead / household |
|----|----------|--------------------------------|
| S01 | New prospect — contact true | `b4a30001-…` / `a4a30001-…` |
| S02 | New prospect — contact false | `b4a30002-…` / `a4a30002-…` |
| S03 | Legacy/missing contact permission | `b4a30003-…` / `a4a30003-…` |
| S04 | Exact trusted match (canonical HH) | `b4a30004-…` / `a4a30004-…` |
| S05 | Possible duplicate + pending review + resolve task | `b4a30005-…` provisional / `a4a30005-…0c5` candidate |
|     | After migration **023**, confirm-same should succeed with the open resolve task present (task completes on resolution). |
| S06 | Repeat diagnostic (2 assessments) | `b4a30006-…` / `a4a30006-…` |
| S07 | Sheets sync failed | `b4a30007-…` / `a4a30007-…` |
| S08 | Task automation failed | `b4a30008-…` / `a4a30008-…` |
| S09 | Soft-deleted automatic task | `b4a30009-…` / `a4a30009-…` |
| S10 | Unsafe provisional + extra assessment | `b4a30010-…` / `a4a30010-…` + 2nd assessment |
| S11 | Assigned household (if advisor-a exists) | `b4a30011-…` / `a4a30011-…` |
| S12 | Unassigned household | `b4a30012-…` / `a4a30012-…` |

Owner/advisor users (S13/S14) are **not** created by this SQL — use bootstrap / Dashboard Auth as above.

## Interactive QA entry points

- Public: `npm run dev` → `/family-assessment`, `/privacy`
- CRM: `/crm/login` → `/crm/intake`, household overview IFD widget, Tasks
