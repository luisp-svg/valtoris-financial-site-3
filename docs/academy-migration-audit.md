# Offline migration history reconciliation

Before preparing Academy database changes, compare saved development/production
migration ledgers with the repository SQL. This tool performs local reads only;
it has no Supabase client, credentials, network requests or migration execution.

```sh
node scripts/audit-migration-history.mjs \
  --development /path/outside/repo/development-ledger.json \
  --production /path/outside/repo/production-ledger.json \
  --migrations supabase/migrations > /path/outside/repo/migration-report.json

node --test scripts/audit-migration-history.test.mjs
```

Each ledger is an array (or `{ "migrations": [...] }`) containing `version`,
`name` and `statements`. Version must be a numeric string to preserve leading
zeros. Statements must be a string array or null; absent/empty/comment-only SQL
is reported as unavailable. A metadata-only migration list cannot prove parity.

The JSON report includes counts, hashes, matching source filenames, matching SQL
under other version numbers, name differences and review reasons. It omits SQL
bodies. Keep snapshots and reports outside the repository: even schema and
function definitions can contain private operational details. Do not export
customer records, secrets or database credentials for this comparison.

`--fail-on-review` returns exit code 2 when any row needs review. Invalid inputs
return 1 without printing raw JSON/SQL. A report alone does not authorize changes.

## Interpret conservatively

- `text-match` ignores outer comments, whitespace and empty statement separators.
  Quoted strings, identifiers and dollar-quoted function bodies stay intact.
  Cosmetic differences inside a function may still require manual review.
- A text match is not SQL semantic equivalence, successful replay, matching live
  schema, matching ownership/privileges, or evidence that a migration was run.
- Different timestamps can contain the same SQL. Map their provenance instead of
  blindly applying every version absent from an environment ledger.
- Verification-marker migrations may only assert that objects already exist.
  Map them to reviewed creation DDL for fresh replay; do not treat them as missing
  functionality just because their text differs from the source file.
- Classify top-level data backfills and scheduler setup separately from schema.
  Statements inside function bodies do not mean the business action ran.
- Preserve installed migration history. Recover missing SQL provenance and
  compare live catalogs before designing additive convergence migrations.

For Valtoris Academy, the initial audience is existing Valtoris advisors. This
reconciliation is the first baseline task; it adds no Academy routes, schema,
permissions, settings or deployment behavior.
