/**
 * CRM-9B browser QA checklist (manual).
 * Owner Agency Operations on /crm; advisor Command Center must not regress.
 */

export const CRM_9B_DESKTOP_QA = [
  'Owner /crm shows Agency Operations eyebrow (not CRM Home Command Center)',
  'Advisor /crm still shows personal Needs Attention + MetricStrip Command Center',
  'Agency Snapshot metrics use exact counts (not a 200-row sample)',
  'Won/lost this month footnote mentions America/Chicago and closed_at',
  'Pipeline Health stage totals match full open/on_hold set',
  'Advisor Workload includes Unassigned and sorts by Needs Attention (not wins)',
  'Operational Alerts link to pipeline/tasks/households drill-downs',
  'Recent Activity only claims stage/assignment/recommendation_converted events',
  'Quick Actions remain available for owners',
  'Partial section failure shows Retry without blanking the page',
  'Keyboard focus reaches metric links, workload table, and alert rows',
  'Common laptop (~1280) and wide desktop (~1920) layouts',
] as const

export const CRM_9B_MOBILE_QA = [
  'Narrow (~360) and larger (~430): sections stack; metric grid becomes 2 columns',
  'Workload table scrolls horizontally without page overflow',
  'Alert and stage rows remain tappable; titles wrap',
  'Navigation drawer still works from owner Home',
  'Zero-state and error-state layouts remain readable',
  'Safe-area padding preserved via existing CRM shell',
] as const
