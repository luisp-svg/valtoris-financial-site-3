# Flagship Family and Business Owner Report Cards

## Intended client experience

Family and Business Owner are the primary coordinated reviews for established households, professionals and business owners. Income and revenue bands supply unscored context; they do not determine eligibility or change the grade. Focused reviews remain supporting entry points.

The first question establishes the visitor's priority. Sections cover their situation, financial resilience, protection, retirement and professional coordination. Business branching skips benefits for no employees, buy-sell questions for sole owners, and financing records when financing is not planned. Family funding estimates are optional and omitted for a visitor supporting only themselves.

A complete preliminary report is calculated in browser memory before contact details. Opening and completing a flagship questionnaire does not call the assessment API. Saving requires the existing name, email, phone, privacy acknowledgment and storage acknowledgment. Optional contact and marketing permissions remain separate. The same server validators and report calculations apply when saving and retrieving results.

The report contains strengths, reported review tasks, unknowns, private discussion items, answer context, three explained review priorities, category preparation grades, and an answer-linked 90-day plan. The existing professional team is included in the context. It does not establish coverage adequacy, financial security or suitability.

## Versioning and persistence

`flagshipVersion: 1` is accepted only for the recognized Family/Business profiles with `cardVersion: 1`, `planningVersion: 1` and their required strategy version. The flag is retained in CRM answer payloads and optional secondary logging. Existing assessment taxonomy and schema are unchanged. Submissions without the new flag retain their earlier questionnaire and grading. No database migration is required.

Unknown/private answers are excluded from the score and remain distinct in the report. Not-applicable items are excluded from its denominator. Applicable scored practices have equal weight: current 100, partial 50, missing 0. The flagships retain their published A90/B75/C60/D40 scale; supporting cards retain their historic scale, now displayed explicitly. Reserve bands are educational preparation benchmarks, not individualized reserve targets.

## Review and release evidence

- Node 22.23.5: type check and production build pass.
- Targeted checks: 151 tests pass before the final routing-context extension; the full suite covers that extension.
- Full regression: 4,132 passed, 306 skipped, one pre-existing failure in `crm/production/boardLayoutContracts.test.ts`.
- The same CRM layout failure reproduces on an untouched checkout of the branch base. `src/styles.css` is unchanged by this work.
- Browser walkthrough: Family form including optional calculation; Spanish Business form including the no-employee path; visible report before contact details.
- Business scheduling context automatically selects the existing Luis calendar. No appointment was booked.
- Phone-width Business sample: no document horizontal overflow; section anchor targets resolve.
- No live assessment saves, customer contacts, bookings, schema changes or production publication were performed.
- Saved-report persistence is tested with mocked database and delivery dependencies, not the production database or calendar.

Generate standalone fictional report examples with:

```sh
node scripts/export-flagship-reviews.mjs /absolute/review-output-directory
```

Reviewing, deploying and measuring are separate steps. Validate configured staging save/retrieval and booking against approved test accounts before production promotion. Conversion improvement is a hypothesis to measure by card: completion, booking, attendance and completed purchase; it is not an established outcome of this change.
