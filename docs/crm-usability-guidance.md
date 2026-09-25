# CRM usability guidance phase

Approved by Luis following the September 25, 2026 live usability review.

Home now provides Find a client and Review incoming leads shortcuts, an ordered client-work guide, and a Today heading for existing attention data. Owner alerts appear before agency metrics. Owner data remains agency-wide; this phase does not create a personal task queue or change role permissions.

Households now list saved intake metadata across member, contact, and report-card origins, with server pagination and links to the existing source-specific intake/history screen. Selected-record status explicitly says when it applies only to that record. The list does not fetch intake answers or sensitive Life fields. Existing source validation still runs when an intake is opened; a source that is no longer available can prevent opening its historical intake.

Contacts, household onboarding, and report navigation use clearer wording. Saved goal identifiers use existing questionnaire labels; unknown historical values remain unchanged. Snapshot descriptions no longer expose database field names.

No migrations, automatic messages, client writes, task-completion changes, new permission models, or production deployment are included.

## Verification

- Full suite: 3,078 passed; 306 skipped (environment-dependent suites remain skipped).
- TypeScript, zero-warning ESLint, production build, function count, server ESM imports, and browser Activity insertion guard passed.
- Saved-intake tests cover household/read scope, excluding answers, original-source links, pagination, and errors/malformed metadata.
- Local Vercel production packaging passed; all 12 Node functions imported successfully.
- Local sample-data layout inspected at desktop and 390px phone width. Production authenticated intake saves, archive recovery, and end-to-end advisor-role behavior were not retested by this phase.
- Existing large JavaScript bundle warning remains; code splitting is outside this phase.
