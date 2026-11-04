# TAC pagination and security — reconciled local candidate

Prepared October 28, 2026. This supersedes the candidate based on older GitHub main.

## Source reconciliation

The production alias now points to `dpl_3VqhHeF2TyzaXXZZG9nnnqyYZZ6S`, the explicitly authorized Incoming Leads release. It retains the student-loan save fix; this broader candidate retains both releases. The earlier
`dpl_8DuaVJXDbo87E4j66TxwMR1u2cWH` source tree was retrieved read-only.
Every one of its 1,710 source files matched the recovered release baseline by SHA-1
before changes. The archive supplied all source files; `.vercelignore` was recovered
directly from the deployment. Both edited household application files matched exact
deployed hashes. Recent funnels, appointments and intake routing are retained.
The earlier GitHub baseline failures were not the state of this production source.

## Changes

- Server-side household/member-name search and filters before 50-record pagination;
  exact totals, stable order, safe last-page clamp, Retry and cancelled stale results.
- SECURITY INVOKER preserves household/intake/member/advisor/stage RLS. Summary-only
  intake access cannot search or disclose hidden member names. List responses omit DOB.
- Stable accessible search name, grouped pager controls, 44px touch targets and wrapping
  at phone widths.
- Restrict auth trigger direct execution, pin history trigger search path, and remove
  unnecessary browser TRUNCATE/REFERENCES/TRIGGER privileges. DML and service-role
  access, RLS and memberships are preserved.
- Replace duplicated fixed migration counts with an explicit filename/SHA-256 source
  inventory. Negative tests reject unexpected additions, deletions and changed SQL.
  Existing historical hash and feature-boundary assertions remain. Inventory is not
  evidence that migrations have been installed. The two new SQL files are candidates.

## Validation

- 3,845 local tests passed in 441 test files; zero failures. Hosted and local-Supabase
  integration suites (`*.crmDev.test.ts` and `*.db.test.ts`) were excluded from this run.
- All 7 focused isolated PostgreSQL tests passed separately. The dataset contains
  1,581 synthetic households; tests cover late pages, literal member search, filters,
  no duplicate pages, denied identities, hidden members, grants and auth trigger behavior.
- TypeScript, changed-file lint, Node 22.23.4 build, Activity insertion guard, server
  ESM import guard and 12-function budget passed. Existing bundle-size warning remains.
- Browser preview used synthetic data and a mocked RPC transport. Verified page 1→2,
  search for household 1,581 resetting to page 1 of 1, disabled Next on the last page,
  explicit empty search state, simulated failure and successful Retry. The database/RLS
  layer was tested separately; this is not hosted end-to-end authentication evidence.
- Phone frames: 390px and 430px (375px/415px content after scrollbars), no horizontal
  overflow. Both pager controls measured 44px tall. This is not real-device certification.
- Exact patch application is checked against the matched production source baseline.

## Incoming Leads follow-up — deployed separately

- Remove the implicit 150-lead ceiling. Read authorized leads in 100-record ranges with submitted-time and ID ordering; enrich each batch using the existing allowlist and RLS.
- Compute filters and badges from the assembled queue, then show 50 rows/cards at a time, reset on filter changes, clamp pages, and provide Retry.
- Fail the load on a later-page error or a repeated lead boundary instead of presenting partial totals as complete.
- 128 intake tests passed across 18 files, including 1,201 synthetic leads. Type checking and changed-file lint passed. These results supplement the earlier baseline tests above.
- This is bounded batch loading plus display pagination, not database-side filtered aggregates. The full authorized queue is still assembled in the browser, so larger queues need a server-side summary/filter endpoint. Offset reads are not a transaction snapshot.
- Hosted development validation was retried October 28; the connector still fails with database authentication error 28P01. No credentials were changed and no migration applied.

## Release sequence — NOT executed for broader fixes

1. Review the reconciled patch and both new migrations.
2. Validate against a production-like development schema and real authenticated
   owner/advisor/intake-only/inactive/outsider sessions; verify storage/session behavior.
3. With explicit hosted-change authorization, apply only the new directory migration
   before deploying its UI. Hardening can be reviewed/released independently. Never
   replay the historical migration inventory blindly.
4. Under separate production release authorization, release the reviewed source and
   migrations, verify real totals/search/auth onboarding/history, and rerun advisors.

Rollback the UI/API first if rolling back pagination; the unused read-only function
may remain pending review. Record pre-release grants and restore only specifically
required grants if necessary; never blindly restore broad PUBLIC/anon privileges.

The household pagination/security candidate remains local. The separately approved student-loan and Incoming Leads fixes were deployed to production. No database changes, queue runs,
provider settings, client communications, or real client record edits were performed.
Leaked-password protection, other queue caps, commission reconciliation, missing
placement dates, benefits, universal cases and agency isolation remain separate work.
