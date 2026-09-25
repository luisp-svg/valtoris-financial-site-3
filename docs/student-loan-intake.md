# Private Student Loan client intake

The intake begins inside signed-in CRM from an existing Manual Contact detail or a completed public report-card detail (including the embedded Intake view). It reuses the source household and client identity. It does not create a new lead, rescore a report, or modify the report's original answers.

Advisors select review tracks, enter loan records and relevant supporting information, and save a draft. A draft must be saved before completion. Completion is confirmed explicitly and produces a preserved read-only version. The same source entry point lists earlier intakes and supports starting a new review. Drafts cannot silently overwrite another tab's saved revision. No intake answers are written to browser storage.

The document checklist records status only; no upload service or client links are included. No FSA credentials, verification codes, Social Security numbers, or full bank/account number fields are provided. No external exports, automatic eligibility findings, or messages are added.

## Storage and authorization

Luis approved the Student Loan database change set after reviewing STUDENT_LOAN_INTAKE_STORAGE_PLAN.md. Migrations 058–061 reuse assessments with `student_loan_intake` and `advisor_onboarding`. The generated contract in 059 matches `studentLoanSchema.ts`; check with `node scripts/student-loan-intake/export-contract.mjs --check`. Future schema changes require a new version and migration, not regeneration of an already released migration.

`save_student_loan_intake` requires an active owner/advisor, household access, and an active same-household Manual Contact or completed public report. Restrictive policies block direct authenticated intake table mutations. Database triggers enforce private capture, answer validation, immutable provenance, completion preservation, and advancing revisions. A unique index prevents duplicate active drafts per household/source. Creation/completion use private CRM Activities with no answer content in the activity message or metadata.

The report-card assessment types, grades, scoring, public tokens, and existing RLS permissions are unchanged. The new policies only restrict access to the new private type. Existing public report filters exclude this type.

## Verification on 2026-09-25

- 3,047 tests passed; 292 existing tests skipped. Migration inventory assertions now explicitly include the four approved files; existing migration checks remain.
- Type check, lint, production build, server imports, function-count guard, browser Activity insertion guard, generated contract comparison, and whitespace checks passed.
- Production packaging native-imported all 11 Node functions successfully.
- `scripts/sql/student-loan-intake/verify.sql` passed in development, using synthetic households and a temporary auth user inside a rolled-back transaction. Tests exercise both origins, draft/update/completion, historical versions, original-report preservation, private activities, invalid/incomplete answers, anonymous calls, household access, stale revisions, duplicate creation, source substitution, direct table writes, and completion preservation. This includes sequential stale-edit tests; simultaneous multi-connection load testing was not performed.
- Migrations 058–061 applied to development and production. No real client records changed by database QA.
- Browser visual/interactive verification was unavailable: the browser tool could not verify its administrator security policy. No alternative browser path was used to bypass that restriction. Automated rendering/build/database checks do not establish a visual pass.
- Unsaved refresh/close and link navigation prompt before leaving; browser back navigation is not reliably interceptable in the existing BrowserRouter architecture. Save drafts before using browser back.

Life Insurance intake and household/contact archive recovery are separate phases and are not part of this release.
