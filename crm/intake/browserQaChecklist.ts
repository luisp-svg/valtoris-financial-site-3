/**
 * Manual browser QA checklist for CRM Intake duplicate resolution (Phase 4.5).
 * The repo has no Playwright/Cypress harness — these steps are for human verification.
 */

export const INTAKE_BROWSER_QA_CHECKLIST = [
  'Owner can open /crm/intake from the CRM sidebar (Intake).',
  'Advisor access follows existing RLS (assigned / unassigned pool only).',
  'New prospect rows appear with Initial Financial Diagnostic label (not Financial Progress).',
  'Exact trusted match rows show matched household and link to workspace.',
  'Possible duplicate rows show Needs review / Possible duplicate status.',
  'Filters work: needs review, new prospects, exact matches, possible duplicates, unassigned, assigned to me, sheets sync issue.',
  'Default ordering is newest submissions first.',
  'Loading, empty, and filtered-empty states render without raw PostgREST errors.',
  'Mobile (<900px) uses card layout; desktop uses table.',
  'Detail panel shows submitted snapshot separately from CRM linkage.',
  'Consent fields display independently; no contact permission is visually obvious.',
  'Sheets state shows Synced / Sync issue / Pending / Not required without raw Apps Script errors.',
  'Owner can open Confirm Same Household dialog with explicit consequences listed.',
  'Owner can open Keep as Separate Household dialog with explicit consequences listed.',
  'Leave pending closes the detail panel without mutating data.',
  'Confirm same household refreshes queue, re-links lead/assessment, merges provisional household, preserves public_self_report.',
  'Keep separate resolves review, keeps provisional active, leaves candidate unchanged.',
  'Advisor does not see enabled Confirm / Keep separate controls (owner-only v1).',
  'Stale/already-resolved reviews show a safe conflict message without corrupting UI state.',
  'Public Family submission flow remains unchanged.',
  'Privacy Policy route exists at /privacy; production release remains blocked until legal review.',
  'Owner sees Archive / Dismiss on Intake detail; Open household remains the primary CTA.',
  'Assigned advisor sees Archive only when existing household assignment proves access; unassigned-pool visibility does not enable Archive.',
  'Archive dialog lists exactly four reasons: Dismissed, Not a Fit, Spam, Test / Accidental. None is labeled Delete.',
  'Confirmation explains the household, assessment, and CRM history remain.',
  'Pending duplicate review disables Archive with resolve-first helper copy.',
  'Successful archive refreshes the active queue (deleted_at IS NULL), keeps the user on Intake, and does not write Sheets, Opportunity, or Activity from the browser.',
] as const

export const DUPLICATE_RESOLUTION_BROWSER_QA_CHECKLIST = [
  'As owner: open possible-match intake record and compare provisional vs candidate.',
  'Confirm same household: queue refreshes; lead and assessment on candidate; provisional merged_into set; canonical contact unchanged.',
  'Confirm same household: activity appears on resulting household; diagnostic remains Initial Financial Diagnostic / public_self_report.',
  'Keep separate: review resolved; provisional remains active; candidate unchanged; activity recorded.',
  'Advisor cannot resolve; public user cannot access /crm/intake; anonymous cannot execute RPC.',
  'Retry same action after success is idempotent; conflicting action returns safe conflict.',
] as const
