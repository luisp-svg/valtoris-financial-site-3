/**
 * Manual browser QA checklist for Household Initial Financial Diagnostic (Phase 5).
 */

export const HOUSEHOLD_IFD_BROWSER_QA_CHECKLIST = [
  'Open a new-prospect household Overview and confirm Initial Financial Diagnostic card (not Financial Progress).',
  'Open View Diagnostic and confirm score, grade, six categories, priorities, submitted snapshot label, consent rows, FP separation copy.',
  'Open View History and confirm newest-first ordering with Latest chip.',
  'Seed/submit two public Family diagnostics; Overview shows latest; both remain in history.',
  'Exact-match household shows diagnostic under canonical household; no merge action on diagnostic pages.',
  'After confirm-same-household, diagnostic appears under canonical household; provisional is not an active workspace destination; capture stays self-reported; FP unchanged.',
  'After keep-separate, diagnostic remains on provisional household; candidate does not receive it.',
  'Authorized owner/advisor access follows household RLS; cross-household assessment URL shows unavailable; public routes cannot access.',
  'Mobile history uses cards; long emails wrap; no raw JSON or capture_channel labels.',
  'Privacy Policy route exists at /privacy; production release remains blocked until legal review.',
] as const
