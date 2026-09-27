# Report Card concurrent-ingestion correction

Migration 072 and the server retry loop address concurrent public Report Card submissions. Production's function body was read on September 25, 2026 and matched migration 054; production migration history was 001–071. Execute grants were postgres/service_role only. No production migration was applied during development.

The previous function created households and members before a nested lead-insert exception handler. Two same-UUID requests could both pass the initial replay check, create households, and have the losing lead insert return the winner without rolling back its extra household. Different UUIDs could also share a stale new-prospect classification.

The correction locks the submission UUID before side effects, then takes normalized contact locks and checks for active contact overlap before accepting `new_prospect`. A stale snapshot raises `retry_match` before inserting anything. The existing application classifier refreshes candidates, with at most three persistence attempts. The submission UUID, score, consent and resolved advisor metadata stay fixed. Tasks, Sheets and AgentCRM run only after persistence succeeds. Unexpected unique violations propagate so the entire RPC rolls back.

No new matching/scoring engine is introduced. Exact and possible-match behavior is preserved; partial matches still require duplicate review. Locks coordinate this Report Card writer, not every CRM writer. Insurance, Digital Identity, imports and manual changes have their own transaction paths. This is not a universal contact uniqueness guarantee. The intended server RPC runs at PostgreSQL's default READ COMMITTED isolation; it should not be wrapped in a long-lived repeatable-read transaction.

## Repeatable database QA

Install locked dependencies, then point the runner at a disposable local PostgreSQL 17 instance using normal `PGHOST=127.0.0.1`, `PGPORT`, `PGUSER`, and `PGPASSWORD` environment variables. Run:

```sh
node scripts/qa/report-card-concurrency.mjs
```

The runner refuses non-loopback hosts, creates a uniquely named database, applies migrations 001–071 with minimal Auth/Storage scaffolding, reproduces both original races, applies 072, and tests deterministic overlapping transactions. It also checks downstream rollback, all seven Report Card types, partial-match review, first-touch preservation, two-advisor isolation, RPC grants and unchanged RLS definitions. It restores the captured function definition to validate rollback, then drops only its own test database. It makes no API/Sheets/AgentCRM calls. This PostgreSQL harness does not substitute for hosted Supabase Auth/API or end-to-end production QA.

The TypeScript suite additionally tests refreshed matching, unchanged scoring/attribution inputs, bounded retries, permanent errors, and secondary-effect suppression on failure.

## Release and rollback

Deploy the server retry handling before applying 072, or coordinate both changes in one reviewed release. The new server remains compatible with 054. An old server paired with 072 fails safely on a stale-match response but cannot automatically retry it.

Before production apply, capture `pg_get_functiondef`, function ACL/owner/search path, and migration history again; ensure this change still applies to the deployed writer and capture a normal database backup. Apply only the reviewed migration through the established migration workflow. Do not re-run or edit 001–071. No backfill, new tables, columns, or RLS changes are part of 072.

Rollback is a reviewed reversing migration restoring the captured function definition while retaining its service-role-only grants. Local QA exercises that restoration. Rolling back restores the race and does not clean historical duplicate records. Do not bulk-delete households as part of rollback; historical cleanup is a separate reviewed task.

## Attribution and deployment verification follow-up

The subsequent Phase 0 continuation distinguishes operational advisor/campaign lookup failures from genuinely invalid or unpublished links. Report Card ingestion returns a safe failure before matching or persistence when lookup infrastructure fails, preserving the browser's existing same-submission retry. Unknown/unpublished cards retain organic-ingest behavior; unknown/disabled campaigns retain the trusted advisor with no trusted campaign. No schema change is needed for this follow-up. The shared campaign resolver exposes an optional failure marker; Report Card ingestion handles it explicitly. Digital Identity connection behavior is otherwise unchanged.

Vercel access was restored through the normal CLI refresh. Production revision 1e7e062 and both custom domains were verified. Local Vercel build and all 12 Node function native-import checks passed using non-secret placeholders because production sensitive values cannot be exported. This validates packaging, not the production secret values.

Read-only production metadata verified RLS on all 51 public tables, no anonymous/public policies and no anonymous-readable public views. The ingestion RPC remains service-role-only. These checks do not replace authenticated hosted authorization tests.

Production write smoke tests are awaiting explicit approval after automatic review rejected them as live mutations with possible downstream effects. No test requests were sent and no test records were created. Migration 072 and the attribution correction remain local, uncommitted and undeployed. Phase 1 remains on hold.


## Final Phase 0 browser continuation

Six deployed browser flows reached saved results. Retirement could not submit without its legacy combined education/contact consent, despite shared contact permission being optional. The local fix removes that duplicate checkbox and makes follow-up preferences optional; canonical contact permission remains in the shared consent snapshot, and scoring is unchanged. Four regression cases cover no-contact validation, score equality and English/Spanish rendering. Full suite: 3,095 passed, 306 skipped. Typecheck, lint, build and guards pass. This correction needs both frontend and server release; it is not deployed.

The user authorized cleanup. The labeled synthetic household, 13 assessments/leads, 13 tasks, 39 Activities and one member were deleted with guarded transactional checks. Sheets cleanup still requires the receiving spreadsheet link. Short-form questionnaire recommendations are separate from the runtime corrections and must not fabricate absent scoring inputs.
