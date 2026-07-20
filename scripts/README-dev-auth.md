# Development Auth Bootstrap (valtoris-crm-dev only)

Creates or repairs **real** Supabase Auth email/password users for local CRM login testing.

This exists because dry-run SQL previously inserted placeholder `auth.users` rows with fixed UUIDs (`aaaaaaaa-aaaa-…`). Those rows are not usable for normal password auth / recovery.

## Safety locks (hard)

The script aborts **before any write** unless both are true:

1. `SUPABASE_URL` hostname is exactly `cxgiaevervjttbuiramd.supabase.co`
2. `CONFIRM_DEV_AUTH_BOOTSTRAP` is exactly `cxgiaevervjttbuiramd`

It never prints passwords or the service-role key.  
It never uses `VITE_*` for the service-role key.  
It does **not** create users from the CRM login UI.

## Accounts

| Email | Role | Advisor slug |
|-------|------|----------------|
| `owner.dev@valtoris.test` | `owner` | `dev-owner` |
| `advisor.a@valtoris.test` | `advisor` | `advisor-a` |
| `advisor.b@valtoris.test` | `advisor` | `advisor-b` |

Emails are auto-confirmed. Profiles use the **exact** Auth UUIDs. `is_active = true`.

## Required environment variables

Put real values in project-root `.env` (gitignored). The npm script loads that file with Node:

`node --env-file=.env scripts/bootstrap-dev-auth.mjs`

**Precedence:** already-exported shell environment variables override `.env`. That is intentional. If you see a placeholder hostname like `your_project_ref.supabase.co`, unset a stale shell value:

```bash
unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
```

```bash
# Must resolve to hostname cxgiaevervjttbuiramd.supabase.co
SUPABASE_URL=https://cxgiaevervjttbuiramd.supabase.co

# Server-only — never put this in VITE_* or commit it
# Must be sb_secret_* or legacy service_role JWT (NOT anon / sb_publishable_*)
SUPABASE_SERVICE_ROLE_KEY=<real-service-role-or-secret-key>

# Explicit confirmation token (project ref)
CONFIRM_DEV_AUTH_BOOTSTRAP=cxgiaevervjttbuiramd

# Passwords (prefer per-user; shared fallback allowed)
DEV_OWNER_PASSWORD=<real-dev-password>
DEV_ADVISOR_A_PASSWORD=<real-dev-password>
DEV_ADVISOR_B_PASSWORD=<real-dev-password>

# Optional fallback if a per-user password is omitted:
# DEV_AUTH_PASSWORD=<real-dev-password>
```

The script aborts if values still contain placeholders such as `YOUR_PROJECT_REF`, `your_actual_service_role_key`, or `choose_a_secure_password`.

Also keep your normal CRM client vars for the app:

```bash
VITE_SUPABASE_URL=https://cxgiaevervjttbuiramd.supabase.co
VITE_SUPABASE_ANON_KEY=<real-anon-key>
```

## How to set passwords

1. Choose strong **development-only** passwords (min 8 characters).
2. Set `DEV_OWNER_PASSWORD`, `DEV_ADVISOR_A_PASSWORD`, and `DEV_ADVISOR_B_PASSWORD` in `.env`.
3. Or set one shared `DEV_AUTH_PASSWORD` used when a per-user var is missing.
4. Do not commit `.env` or paste passwords into chat/docs/commits.

## How to run

From the repo root (does not run automatically):

```bash
npm run bootstrap:dev-auth
```

This always loads project-root `.env` via `node --env-file=.env`. Ensure `CONFIRM_DEV_AUTH_BOOTSTRAP=cxgiaevervjttbuiramd` is set in `.env` (or intentionally exported in the shell).

The script prints the target hostname and planned emails, resolves a **full read-only plan** for all three accounts, then writes. It does **not** paginate `auth.admin.listUsers` (that 500s on malformed dry-run Auth rows).

### Read-only placeholder diagnostic

If Admin calls fail with status 500, inventory CRM references first (no writes):

```bash
npm run bootstrap:dev-auth:diagnose
```

Staged repair plan (Admin API and SQL are **not** atomic; each phase has checkpoints):

See `scripts/sql/repair-dev-auth/README.md`

| Phase | Command / file |
|-------|----------------|
| Diagnose | `npm run bootstrap:dev-auth:diagnose` |
| A verify | `scripts/sql/repair-dev-auth/phase-a-verify.sql` |
| B neutralize Auth emails | `phase-b-neutralize-auth.sql` (default `ROLLBACK`) |
| C create real users | `npm run repair:dev-auth:phase-c` |
| D public remap | `phase-d-remap-public.sql` (default `ROLLBACK`) |
| E delete placeholders | `phase-e-delete-auth.sql` (default `ROLLBACK`) |

Do **not** use the deprecated monolithic `scripts/sql/repair-dev-placeholder-auth.sql`.

### What bootstrap does (idempotent)

- Resolves each account via `profiles` + `auth.admin.getUserById` (known placeholder UUIDs / profile ids only).
- **Placeholder Auth UUID** (`aaaaaaaa-aaaa-…`): archive profile email → rename Auth email → create real Auth user → remap FKs + `advisor_profiles.user_id` (keeps advisor profile IDs) → delete placeholder Auth user.
- **Existing real Auth user**: updates password + email confirmation; ensures profile role / `is_active`.
- **Missing user**: creates Auth user + profile + advisor profile.
- Aborts before any write if `getUserById` returns 500 for a known placeholder (run diagnose + SQL repair first).

## How to verify Auth users

**Dashboard:** Authentication → Users — confirm the three emails exist, are confirmed, and IDs are **not** `aaaaaaaa-aaaa-…`.

**SQL Editor:**

```sql
select id, email, email_confirmed_at, created_at
from auth.users
where email in (
  'owner.dev@valtoris.test',
  'advisor.a@valtoris.test',
  'advisor.b@valtoris.test'
)
order by email;
```

## How to verify matching profiles and roles

```sql
select id, email, role, is_active, deleted_at
from public.profiles
where email in (
  'owner.dev@valtoris.test',
  'advisor.a@valtoris.test',
  'advisor.b@valtoris.test'
)
order by email;
```

Expect:

- `owner.dev@valtoris.test` → `role = owner`, `is_active = true`
- advisors → `role = advisor`, `is_active = true`
- `profiles.id` equals `auth.users.id` for each email

Optional advisor profiles:

```sql
select ap.slug, ap.user_id, p.email, p.role
from public.advisor_profiles ap
join public.profiles p on p.id = ap.user_id
where ap.slug in ('dev-owner', 'advisor-a', 'advisor-b')
order by ap.slug;
```

## How to test login locally

1. Ensure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. `npm run dev`
3. Open `http://localhost:5173/crm/login`
4. Sign in as `owner.dev@valtoris.test` with `DEV_OWNER_PASSWORD`
5. Confirm redirect to `/crm`, shell shows email + role `owner`
6. Log out; repeat with an advisor account
7. Logged-out visit to `/crm` should redirect to `/crm/login`

## Manual dashboard steps

Usually none after a successful script run. If Auth still shows placeholder UUIDs, re-check env guards and re-run. Do not manually insert into `auth.users` with SQL.
