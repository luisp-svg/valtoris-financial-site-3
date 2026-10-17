# Report Card follow-up verification

The controlled TSP, Health, and Student Loan production tests saved their leads, created AgentCRM contacts with the intended specialists, and checkpointed opportunity IDs. All three stopped before task creation with `delivery_retry`. The precise upstream failure was not retained; search-index delay is a hypothesis, not a confirmed cause.

## Proposed change

Keep the complete contact/pipeline opportunity search and duplicate holds. After selecting or creating an opportunity, read its saved ID directly with GET `/opportunities/:id` and verify its ID, contact, pipeline, and location before task creation. A saved ID absent from search must not cause another create. Do not change contact consent, tags, opportunity status, stage, or existing task completion.

The direct endpoint is documented at https://marketplace.gohighlevel.com/docs/ghl/opportunities/get-opportunity/ . The transport permits GET only for that endpoint. It does not permit update, delete, or messaging there.

## Live verification after review and deployment

Use only the approved QA identities and destination aliases. Reconcile each saved test delivery through the existing worker after it becomes due, verifying one opportunity and one submission-specific task with the approved assignee. Do not reset unknown-outcome flags or broadly retry historical leads. If direct read-back still fails, inspect a sanitized error category before further writes. The first release remains a candidate until this test succeeds.

The recovery job currently runs daily at 08:00 UTC and processes at most five items. This change does not alter its schedule or purchase a hosting upgrade. A more frequent recovery mechanism remains necessary for timely handling of transient failures.

## Separate calendar change for review

The active strategy calendar uses the AgentCRM default form. Its public form requires a phone number and acceptance of the enabled consent checkbox: “I confirm that I want to receive content from this company using any contact information I provide.” A controlled no-phone/no-marketing test was rejected. No appointment was created.

Prepare a dedicated appointment form with required first name, last name, email, and phone; optional notes; an informational privacy notice; and no required marketing permission. Suggested informational copy: “Valtoris will use these details to arrange your appointment and send appointment confirmations and updates. Booking does not subscribe you to marketing emails or text messages.” This is proposed wording for review, not a legal compliance determination.

Before attaching that form to a live calendar, verify that it does not alter consent or enroll contacts in promotional workflows. Verify appointment confirmation and reminder channels separately. Keep SMS and marketing off for the controlled test. Do not disable consent tracking or broadly enable communications to bypass validation. Inspect the Health and Student Loan calendars separately before applying equivalent settings.

Calendar settings, recovery schedule, and production deployment require review; no live settings are changed by this pull request.

User clarification: phone must remain mandatory. The earlier optional-phone proposal is superseded. PRs #17 and #18 are now deployed; all three saved QA deliveries recovered to synced/verified. No calendar form changes have been applied.
