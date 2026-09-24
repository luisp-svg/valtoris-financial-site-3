# Insurance quote intake

## Release scope

Three Valtoris Financial public routes: `/auto-quote`, `/home-quote`, `/commercial-quote`. Client-facing questionnaires replace Clearview branding and exclude internal agent/training/closing pages. Existing Valtoris site chrome and assessment controls are reused. The isolated branch starts at `04dc5ea`, without the unfinished Home Buyer V2 changes in the user's development checkout.

Forms keep answers in React memory only. Navigation/reload clears them; there is no browser storage, Sheets export, or analytics payload containing underwriting details. Repeaters support up to 20 drivers, vehicles or payroll classes. Commercial BOP exposes liability and property; other selected coverages expose their sections. Deselected values are pruned client-side and rejected server-side. FEIN and license numbers from the supplied commercial questionnaire are optional and remain private CRM fields; the form warns against SSN/payment/medical-record entry.

## Save path

`InsuranceQuotePage` → `POST /api/insurance-quote` → strict shared validation → existing normalized identity lookup/classification → service-only `ingest_insurance_quote` → existing CRM records.

The endpoint requires same-origin JSON, caps requests at 65 KB, applies the existing per-instance abuse limiter, validates a UUID submission key and form timing, and returns only `{ok:true}` after a confirmed database save. Public responses never reveal match outcomes, record identifiers or submitted values. Logs do not contain request bodies or raw database errors.

Migration 056 introduces one server-only RPC; it uses existing households, members, leads, duplicate reviews and private Activities. It adds no tables, columns, assessment types, RLS policies or browser Activity privileges. A transaction and advisory locks prevent partial saves and same-key orphan records. Stable payload fingerprints reject changed-payload replays; archived-key replays do not resurrect submissions. Concurrent quote identities are serialized; stale matching classifications are retried. Exact matches require both contact identifiers and full name agreement. Ambiguous identities create a provisional household for owner review. Existing contacts are never overwritten.

New prospects enter the existing unassigned pool. Exact matches inherit the household's assigned advisor. Commercial company details stay in the quote snapshot linked to the contact household; this phase does not introduce a separate business-entity system. Quote requests appear as their own lead types and include all answers in CRM Intake, without fake scores or Report Card records. Existing assignment and opportunity creation remain advisor actions; no policy, commission, automatic follow-up task, or bound coverage is created by submission.

The existing lead-only duplicate resolver (latest version from migration 027) also accepts the three quote types, keeping its owner-only permission and dependency guards. Digital Identity photo behavior remains intact; quote records cannot use that photo exception. The existing archive allowlist includes quote leads, with Activity written before soft deletion. Historic migrations remain byte-identical.

## AgentCRM automation handoff — prepared, not activated

`server/ingest/insuranceQuote/agentCrmHandoff.ts` is a pure allowlisted projection, with no network calls. It is supplied for the activation phase; the public ingest does not execute it or send data externally. Unresolved identity or absent quote-contact permission yields `held_for_review`.

| Proposed logical field | Value / rule |
| --- | --- |
| Contact | First name, last name, email and phone only |
| Valtoris submission reference | Stable correlation key; never a client-controlled household ID |
| Quote type | `auto`, `home`, `commercial` |
| Source | Valtoris route |
| Stage | `Quote Requested` |
| Assigned advisor | Verified internal ID; map to a verified external user before sending |
| Preferred contact | Email or phone |
| Consent | Version, timestamp, requested channel, quote-specific contact permission |
| Email / SMS marketing | False; quote permission is not marketing consent |

Exclude DOB, FEIN, license numbers, VIN schedules, drivers, property risk details, claims, payroll, revenue and the full answers object. Do not put those details in external tags, notes, notifications, URLs or logs.

Before activation, verify actual location, custom-field IDs, user mappings, pipeline/stage IDs and workflow IDs in AgentCRM. No external IDs are invented. Reuse existing server-side integration capabilities and durable contact links; maintain independent gates. Define durable retry/reconciliation before automatic delivery. Any proposed tags such as `quote-auto` must be verified before use. Existing Report Card gates and mappings are unchanged.

Automatic SMS/email is not enabled in this phase. Approved activation must separately cover the intended workflow, channel consent, message content and suppression behavior. First activation proof should use synthetic records; ambiguous matches stay in owner review.

## Verification and operational limits

- The repository's full verification suite must pass before commit; migration allowlists are extended only for the approved 056. Historical hash checks remain.
- `scripts/sql/insurance-quote/verify.sql` executes synthetic save/replay/conflict/match/resolve/archive checks in a caller-owned transaction which must be rolled back. It also checks service-only RPC grants and absence of assessment creation.
- API/validation tests cover invalid fields, hidden sections, repeaters, consent, contact formats, future dates, request origin/size, throttling, redacted responses and retry behavior.
- Vercel now packages 11 Node functions, within the existing 12-function limit.
- The existing limiter is per server instance, not a global quota. The existing large client-bundle and deprecated Edge middleware warnings remain.
- Browser visual review was attempted but the browser tool could not verify its administrator-enforced policy. No workaround was used and no visual QA pass is claimed.
- Production deployment must use a remote source build. Vercel does not return sensitive production values through `pull`; its local `[SENSITIVE]` placeholders must never be deployed in a prebuilt client bundle.

### Pre-release QA (September 24, 2026)

Full suite: 2,989 passed, 292 skipped, zero failures (364 passing files, 29 skipped). Remote read-only tests used a 60-second timeout to accommodate management-API latency. Typecheck, lint, build, function budget, ESM imports, browser Activity guard and diff checks passed. All 11 packaged Node functions imported successfully. Transactional CRM-development verification passed and rolled back; migration 056 was subsequently applied to CRM development through the migration runner.

## Household profile quote history

The household Overview includes Insurance quote requests. Each dated request opens the shared Intake answer viewer with its sections expanded. Existing stored submissions are available without resubmitting. History pages include 20 requests, newest first, with older/newer navigation. The browser reads only the selected household's non-archived insurance leads through the existing authenticated Supabase client and leads RLS. Load errors offer Retry and are not shown as empty history. No migration or data rewrite is needed.

## Quote delivery (migration 057; activation gated)

Each new quote is atomically enqueued by the leads insert trigger. Existing active quotes are backfilled. The service-only queue records contact/opportunity IDs, attempts, fenced leases and outcome markers. The existing member/contact map is reused. After persistence, intake attempts delivery immediately; the protected GET retry handler processes up to five due requests per run. The Hobby-compatible Vercel fallback cron runs daily at 08:00 UTC, so busy-worker deferrals or failed attempts can wait until that run. This is not a five-minute delivery SLA; higher-frequency scheduling is a separate operational change.

Activation requires AGENTCRM_INSURANCE_SYNC_ENABLED=true, AGENTCRM_INSURANCE_TRIGGERS_VERIFIED=true, the verified Valtoris location, existing AgentCRM server credentials, an approved Supabase host, and CRON_SECRET for scheduled retries. Missing gates mean no external calls. Never set trigger verification true without checking actual workflow behavior.

Only first/last name, email, phone and source are written to contacts. No tags, custom fields, workflow enrollment or messaging calls are made. Existing verified contacts are updated only after independently checking email and phone for conflicts; unlinked contacts require full-name agreement. One open P&C opportunity is reused without resetting its stage. Multiple opportunities or conflicting identity are held. A create whose response is lost is reconciled by lookup; if not found it is held instead of blindly creating again. Later deliveries for the same household wait behind an unresolved create.

Queue status is authoritative; original_source_metadata.agentcrm_handoff is immutable historical intake attribution, not live delivery status. Owner/support review of held rows uses the server-side queue. Resolve the external ambiguity first; requeue only after verifying contact and opportunity IDs. Do not clear create-started markers to force a retry.

Verification: synthetic transport tests cover all three kinds, repeats, identity updates, stage preservation, conflicts, lease loss and uncertain outcomes. scripts/sql/insurance-quote/verify-delivery.sql checks transactional enqueue, single-worker claims, fencing and completed replay. These tests do not substitute for the gated live AgentCRM acceptance test.
