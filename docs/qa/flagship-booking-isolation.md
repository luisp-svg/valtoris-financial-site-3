# Staging booking isolation review

Reviewed November 16, 2026. No live automation was edited, disabled or published.

The shared AgentCRM location contains a published workflow:
`2529ddcf-62d0-4383-b7dd-8851dc78a44c`, revision **4**, last updated
`2026-11-11T02:07:04.668Z`. The read-only builder review showed exactly one
trigger: **Contact changed**, filtered to **Webinar Nov 19 2026 - Consent
Responses / Has changed**. There is no contact-created or appointment trigger.
The revision metadata was independently read by the staging server from the
provider workflow list. [Provider API revision documentation](https://marketplace.gohighlevel.com/docs/ghl/workflows/get-workflow/index.html)
defines version as incrementing on every save.

The QA adapter only creates contacts with synthetic `@example.invalid` email,
no phone, no tags, no custom fields, no assignment and DND enabled. It never
updates contacts, changes the webinar field or enrolls contacts in workflows.
Only the exact silent event calendar is allowed, with no staff/linked calendars,
no active notifications and `toNotify:false`. The booking API additionally
requires exact allowlisted synthetic submission IDs.

An opt-in applies only to hosted QA in Vercel Preview with
`AGENTCRM_QA_REVIEWED_WEBINAR_REVISION=4`. It permits only the exact reviewed
workflow ID, location, published state, numeric revision and timestamp. The
complete workflow list is re-read before each external write. Any changed
revision, unknown status, newly published workflow or incomplete list blocks
the test. No workflow modification API is permitted by this adapter.

This is logical isolation within the shared provider location, not a separate
AgentCRM account. A future workflow edit requires a fresh trigger review and
revision pin; it must never be made to pass by disabling a live workflow.
Production booking paths do not receive this exception.
