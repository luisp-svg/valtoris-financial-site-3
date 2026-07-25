/**
 * CRM-9A browser QA checklist (manual).
 * Keep in sync with the CRM-9 audit §17 / §22.
 */

export const CRM_9A_DESKTOP_QA = [
  'Login redirects to /crm for owner and advisor',
  'Owner dashboard loads metrics and attention without unauthorized flash',
  'Advisor dashboard shows only RLS-visible zeros/rows',
  'Common laptop (~1280) and wide desktop (~1920) layouts',
  'Keyboard focus reaches metric links, attention items, quick actions',
  'Loading, empty, and partial-error + Retry states',
  'New Opportunity opens existing dialog; Add Task goes to /crm/tasks',
  'All dashboard links open the expected household/opportunity/pipeline/task routes',
  'Browser console clean of app errors on happy path',
] as const

export const CRM_9A_MOBILE_QA = [
  'Narrow (~360) and larger (~430) viewports: sections stack, no horizontal overflow',
  'Navigation drawer still works from Home',
  'Tap targets for quick actions and list rows >= 44px feel',
  'Long household/stage/task titles wrap without clipping',
  'Zero-state and error-state layouts remain readable',
  'Scrolling is smooth; no sticky element covers primary content',
  'Safe-area padding preserved via existing CRM shell',
] as const
