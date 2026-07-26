import type { HouseholdAssessmentSummary } from '../types'

export function formatWorkspaceDate(value: string | null | undefined): string {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatWorkspaceDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatAssessmentScore(assessment: HouseholdAssessmentSummary): string {
  if (assessment.overall_grade) return assessment.overall_grade
  if (assessment.overall_score != null && !Number.isNaN(assessment.overall_score)) {
    return String(assessment.overall_score)
  }
  return '—'
}

export function displayOptional(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

/** Review due prefers an incomplete scheduled review; otherwise shows —. */
export function getReviewDueLabel(
  annualReview: { scheduled_for: string | null; completed_at: string | null } | null,
): string {
  if (!annualReview) return '—'
  if (annualReview.scheduled_for && !annualReview.completed_at) {
    return formatWorkspaceDate(annualReview.scheduled_for)
  }
  if (annualReview.scheduled_for) {
    return formatWorkspaceDate(annualReview.scheduled_for)
  }
  return '—'
}

export function getNextReviewLabel(
  annualReview: { scheduled_for: string | null; completed_at: string | null } | null,
): string {
  if (!annualReview?.scheduled_for) return '—'
  return formatWorkspaceDate(annualReview.scheduled_for)
}

export function getLastReviewLabel(
  annualReview: { scheduled_for: string | null; completed_at: string | null } | null,
): string {
  if (!annualReview?.completed_at) return '—'
  return formatWorkspaceDate(annualReview.completed_at)
}
