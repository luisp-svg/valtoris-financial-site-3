# Valtoris Financial Site

Editable Vite + React + TypeScript project for public calculators and the CRM.

## Run locally

```bash
npm install
npm run dev
```

## Build / quality

```bash
npm run build
npm test
npm run lint
npm run typecheck
```

## Deploy to Vercel

1. Import the project in Vercel.
2. Set **browser-safe** env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optional `VITE_*` site vars).
3. Set **server-only** env (no `VITE_` prefix):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for Family CRM ingest)
   - optional `GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL` (Family secondary Sheets)
   - optional `GOOGLE_SHEETS_WEBHOOK_URL` (other calculators)
4. Apply remote Supabase migrations through **022** (order: 020 → 021 → 022 for Sprint 4A.3).
5. Deploy preview, run the Sprint 4A.3 QA checklist, then promote.

See **[docs/sprint-4a3-release-checklist.md](docs/sprint-4a3-release-checklist.md)** for the full environment contract, failure semantics, and release checklist.

### Failure semantics (Family Report Card)

- CRM save failure → visitor does **not** reach results.
- Task automation failure → results still succeed; CRM shows internal task issue.
- Sheets failure → results still succeed; CRM shows Sheets sync issue.

## Local Supabase

```bash
npx supabase start
npx supabase db reset
```

Optional CRM scenario seed (no real PII; see script README before running):

```bash
# After db reset — and after supported auth bootstrap if testing CRM login
psql "$DATABASE_URL" -f scripts/sql/qa-sprint-4a3/seed-crm-scenarios.sql
```

Owner/advisor login users: use `npm run bootstrap:dev-auth` with the locks in `scripts/README-dev-auth.md`.
**Do not** insert malformed manual `auth.users` rows.

## Included

- `src/` app entry and styles
- `components/` reusable UI
- `pages/` public + CRM routes (`/privacy`, `/crm/intake`, household assessments, …)
- `api/ingest-family-report-card.ts` Family → CRM serverless ingest
- `server/ingest/familyReportCard/` server orchestration
- `supabase/migrations/` including 020–022
- `.env.example` sample environment variables (no secrets)
