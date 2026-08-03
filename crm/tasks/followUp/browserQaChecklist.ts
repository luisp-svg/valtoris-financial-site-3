/**
 * Phase 6 follow-up task automation QA checklist.
 */

export const PHASE6_FOLLOW_UP_QA_CHECKLIST = [
  'Migration 022 applied; only review_initial_diagnostic and resolve_possible_duplicate automatic workflows.',
  'New prospect + contact permitted: one review task, consent-aware title, no duplicate on retry.',
  'New prospect + contact denied: review-only title; no call/text/email instruction.',
  'Exact match: task on canonical household; assignment reused only when household already assigned.',
  'Possible match: resolve-duplicate task only; no diagnostic-review task until resolution.',
  'Confirm same household: review task on canonical household; no duplicate on resolution retry.',
  'Keep separate: review task on provisional household; candidate receives none.',
  'Task failure leaves diagnostic intact; Intake shows safe task issue; retry is idempotent.',
  'Anonymous/public cannot create tasks; cross-household spoof rejected.',
  'Public production release remains blocked until Privacy Policy + interactive QA complete.',
] as const
