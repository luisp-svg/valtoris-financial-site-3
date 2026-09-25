# Life Insurance planning intake

Luis instructed “finish the life intake” after receiving the first-phase field and database plan. This release implements that proposed phase: planning information in private CRM, with medical/legal history, medications, SSNs, driver-license details, and banking information handled through the selected carrier's secure application. It does not implement a carrier application or collect those sensitive fields in general CRM notes.

## Advisor workflow

Open an existing CRM contact or completed report card and choose **Life Insurance intake**. The existing household/source is required. Client identity is prefilled for confirmation, but the proposed insured must be identified separately; the contact is not automatically assumed to be the insured.

Capture insured, owner and payer roles; employment/finances; existing coverage; primary and contingent beneficiaries; dependents/rider interest; the needs worksheet; and secure-application progress. Drafts can be saved and resumed. Completion requires a saved draft, explicit confirmation, completed required fields, consistent roles, and valid beneficiary totals. Each populated beneficiary group must total 100%. Undecided beneficiaries or unconfirmed existing coverage require explicit follow-up notes. Completing intake does not issue a policy, bind coverage, approve underwriting, authorize payment, create a production case, or change commissions.

The needs worksheet exposes the source spreadsheet's ten-year income assumption as an editable field. Debt excludes mortgage, which is entered separately. Gross needs, selected coverage and asset offsets, remaining gap, client-requested coverage and the difference are displayed separately. Unknown amounts remain blank; the result is not calculated until all necessary amounts are available. This is a planning calculation, not an automatic insurance recommendation.

Completed versions remain read-only. Start another review from the same source to capture later information. Original report-card answers and grades are preserved and can be viewed as dated context. No private intake answers are placed in browser storage or exported to external CRM/Sheets systems.

## Architecture and access

Migrations 062–064 add `life_insurance_intake`, the versioned field contract, restrictive policies, database validation and guarded persistence. The existing assessments table, household authorization, and private Activity infrastructure are reused.

The two client-intake types share form rendering, source resolution, save acknowledgments, draft/history screens, structural validation, and a private database writer. Public wrapper functions select the type; the internal writer is not executable by authenticated or anonymous callers. No public report type or report score is changed. Existing Student Loan guards, indexes, schema contract and behavior remain covered by regression tests.

The Life guard enforces immutable source/type, private capture, preserved completed records, and a strictly advancing revision. A unique active-draft index plus household locking prevents duplicate drafts for the same source. Browser validation is repeated in the database, including beneficiary totals, role consistency, birth dates, signed net worth, integer replacement years, review confirmation, and handoff evidence status. Activities contain source/record identifiers and titles, not answer content.

Generated contracts can be checked with:

- `node scripts/life-insurance-intake/export-contract.mjs --check`
- `node scripts/student-loan-intake/export-contract.mjs --check`

Released contracts are immutable historical migrations; future field changes need a version/migration review.

## Verification

On 2026-09-25, 3,059 tests passed, with 292 existing tests skipped. Type checking, lint, build, server ESM imports, function budget, browser Activity-write guard, generated-contract comparison and whitespace checks passed. Production packaging native-imported all 11 Node functions.

Both `scripts/sql/life-insurance-intake/verify.sql` and the existing Student Loan SQL suite passed against development. Tests used synthetic client/auth fixtures inside rolled-back transactions and covered both origins, draft/update/completion, preserved history and reports, stale revisions, duplicate drafts, household isolation, anonymous denial, type/source substitution, direct-write protection and Life-specific validation. Sequential stale-edit and duplicate-creation checks were exercised; simultaneous multi-connection stress testing was not performed.

Browser visual/interactive QA remains unavailable because the browser tool could not verify its administrator security policy. That restriction was not bypassed. No real-client production intake was submitted as a test. The shared screen warns on refresh/close and link navigation with unsaved changes; browser back is not reliably interceptable in the existing BrowserRouter setup, so save drafts first.

## Scope boundaries

This phase does not include native medical/banking/SSN collection, carrier-specific underwriting or replacement attestations, file uploads, client self-service links, automatic messages, or household/contact archive recovery.
