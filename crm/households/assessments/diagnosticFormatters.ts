import { parseConsentSnapshot } from '../../intake/intakeFormatters'
import type { IntakeConsentSummary } from '../../intake/types'
import {
  normalizeDuplicateReviewStatus,
  normalizeMatchStatus,
  normalizeSheetsSyncStatus,
} from '../../intake/intakeFormatters'
import type {
  DiagnosticCategoryResult,
  DiagnosticFlagItem,
  DiagnosticLeadSummary,
  DiagnosticPriorityItem,
  DiagnosticSourceAttribution,
  DiagnosticSubmittedAnswer,
  PublicFamilyDiagnosticDetail,
  PublicFamilyDiagnosticListItem,
  SubmittedDiagnosticSnapshot,
} from './types'
import { crmProductLabelForAssessment, isPublicReportCardAssessmentType } from '../../../modules/reportCard/publicIngestCatalog'
import { studentLoanCopy } from '../../../components/assessment/studentLoan/copy'
import { STUDENT_LOAN_QUESTIONS } from '../../../components/assessment/studentLoan/questions'

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function scoreNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function extractDiagnosticCategories(derivedMetrics: unknown): DiagnosticCategoryResult[] {
  const derived = asRecord(derivedMetrics)
  const raw = Array.isArray(derived.categories) ? derived.categories : []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const cat = entry as Record<string, unknown>
      return {
        id: asTrimmedString(cat.id) ?? 'category',
        title: asTrimmedString(cat.title) ?? 'Category',
        score: scoreNumber(cat.score),
        grade: asTrimmedString(cat.grade),
      }
    })
    .filter((value): value is DiagnosticCategoryResult => value != null)
}

export function extractDiagnosticPriorities(
  prioritiesColumn: unknown,
  answers: unknown,
): DiagnosticPriorityItem[] {
  const items: DiagnosticPriorityItem[] = []
  const rawPriorities = Array.isArray(prioritiesColumn) ? prioritiesColumn : []

  for (const entry of rawPriorities) {
    if (typeof entry === 'string' && entry.trim()) {
      items.push({
        title: entry.trim(),
        level: null,
        why: null,
        timeline: null,
        source: 'diagnostic',
      })
      continue
    }
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const title = asTrimmedString(row.title)
    if (!title) continue
    items.push({
      title,
      level: asTrimmedString(row.level),
      why: asTrimmedString(row.why),
      timeline: asTrimmedString(row.timeline),
      source: 'diagnostic',
    })
  }

  const goals = asRecord(asRecord(answers).goals)
  const selected = Array.isArray(goals.selected) ? goals.selected : []
  for (const goal of selected) {
    const title = asTrimmedString(goal)
    if (!title) continue
    if (items.some((item) => item.title === title && item.source === 'submitted_goal')) continue
    items.push({
      title,
      level: null,
      why: null,
      timeline: null,
      source: 'submitted_goal',
    })
  }

  return items
}

export function extractTopPriorityTitles(
  prioritiesColumn: unknown,
  answers: unknown,
  limit = 3,
): string[] {
  return extractDiagnosticPriorities(prioritiesColumn, answers)
    .filter((item) => item.source === 'diagnostic')
    .map((item) => item.title)
    .slice(0, limit)
}

/**
 * Allow-listed advisor-useful flags from derived_metrics.
 * Unknown keys are ignored (no raw JSON dump).
 */
export function extractDiagnosticFlags(derivedMetrics: unknown): DiagnosticFlagItem[] {
  const derived = asRecord(derivedMetrics)
  const flags: DiagnosticFlagItem[] = []

  const currentLevel = asTrimmedString(derived.currentLevel)
  if (currentLevel) {
    flags.push({
      id: 'current_level',
      label: 'Reported financial foundation level',
      detail: currentLevel,
    })
  }

  const gapFormatted = asTrimmedString(derived.protectionGapFormatted)
  const gapAmount = scoreNumber(derived.protectionGapAmount)
  if (gapFormatted || gapAmount != null) {
    flags.push({
      id: 'protection_gap',
      label: 'Estimated protection gap',
      detail: gapFormatted ?? (gapAmount != null ? String(gapAmount) : null),
    })
  }

  const comparison = asRecord(derived.scoreComparison)
  if (comparison.scoreMismatch === true) {
    flags.push({
      id: 'score_recalculated',
      label: 'Score recalculated on capture',
      detail: 'Server recalculation was used as the stored diagnostic result.',
    })
  }

  const critical = Array.isArray(derived.criticalFlags) ? derived.criticalFlags : []
  for (const flag of critical) {
    if (!flag || typeof flag !== 'object') continue
    const row = flag as Record<string, unknown>
    const id = asTrimmedString(row.id)
    const label = asTrimmedString(row.label) ?? asTrimmedString(row.severity)
    if (!id && !label) continue
    flags.push({
      id: id ?? 'flag',
      label: label ?? id ?? 'Flag',
      detail: asTrimmedString(row.detail) ?? id,
    })
  }

  return flags
}

export function extractSubmittedDiagnosticSnapshot(answers: unknown): SubmittedDiagnosticSnapshot {
  const root = asRecord(answers)
  const family = asRecord(root.family)
  const owner = asRecord(root.owner)
  const household = asRecord(root.household)
  const contact =
    asTrimmedString(family.firstName) || asTrimmedString(family.email)
      ? family
      : asTrimmedString(owner.firstName) || asTrimmedString(owner.email)
        ? owner
        : household
  const financial = asRecord(root.financial)
  const protection = asRecord(root.protection)
  const coverage = asRecord(root.coverage)
  const goals = asRecord(root.goals)
  const selected = Array.isArray(goals.selected)
    ? goals.selected.map(asTrimmedString).filter((v): v is string => Boolean(v))
    : []

  return {
    firstName: asTrimmedString(contact.firstName),
    lastName: asTrimmedString(contact.lastName),
    email: asTrimmedString(contact.email),
    phone: asTrimmedString(contact.phone),
    age: asTrimmedString(contact.age ?? contact.currentAge),
    state: asTrimmedString(contact.state),
    maritalStatus: asTrimmedString(contact.maritalStatus),
    numberOfChildren: asTrimmedString(family.numberOfChildren ?? contact.numberOfChildren),
    householdIncome: asTrimmedString(financial.householdIncome),
    monthlyHousingPayment: asTrimmedString(financial.monthlyHousingPayment),
    totalDebt: asTrimmedString(financial.totalDebt),
    emergencyFundMonths: asTrimmedString(financial.emergencyFundMonths),
    monthlyCashFlow: asTrimmedString(financial.monthlyCashFlow),
    retirementContribution: asTrimmedString(financial.retirementContribution),
    currentLifeInsurance: asTrimmedString(
      coverage.currentLifeInsurance ?? protection.currentLifeInsurance,
    ),
    hasDisabilityProtection: asTrimmedString(protection.hasDisabilityProtection),
    hasWill: asTrimmedString(protection.hasWill),
    hasTrust: asTrimmedString(protection.hasTrust),
    beneficiariesReviewed: asTrimmedString(protection.beneficiariesReviewed),
    guardianDocumented: asTrimmedString(protection.guardianDocumented),
    submittedGoals: selected,
  }
}

function studentLoanDisplayText(section: 'fields' | 'answers', key: string): string {
  return studentLoanCopy.en?.[section][key] ?? key
}

function formatStudentLoanFieldValue(fieldId: string, raw: unknown): string | null {
  if (Array.isArray(raw)) {
    const labels = raw
      .map((item) => (typeof item === 'string' && item.trim() ? studentLoanDisplayText('answers', `${fieldId}.${item}`) : null))
      .filter((item): item is string => Boolean(item))
    return labels.length > 0 ? labels.join(', ') : null
  }
  if (typeof raw !== 'string' || raw.trim() === '') return null
  if (fieldId === 'servicer_name') return raw.trim()
  const prefixed = studentLoanCopy.en?.answers[`${fieldId}.${raw}`]
  if (prefixed) return prefixed
  const shared = studentLoanCopy.en?.answers[raw]
  if (shared) return shared
  return raw
}

/**
 * Student Loan assessment JSONB is diagnostic-only. Contact PII is not read here.
 */
export function extractStudentLoanSubmittedAnswers(answers: unknown): DiagnosticSubmittedAnswer[] {
  const diagnostic = asRecord(asRecord(answers).diagnostic)
  const items: DiagnosticSubmittedAnswer[] = []
  for (const question of STUDENT_LOAN_QUESTIONS) {
    for (const field of question.fields) {
      const value = formatStudentLoanFieldValue(field.id, diagnostic[field.id])
      if (!value) continue
      items.push({
        id: field.id,
        label: studentLoanDisplayText('fields', field.id),
        value,
      })
    }
  }
  return items
}

function safeHostFromReferrer(value: unknown): string | null {
  const raw = asTrimmedString(value)
  if (!raw) return null
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return new URL(raw).host || null
    }
  } catch {
    return null
  }
  // Non-URL referrer strings: keep short and non-clickable
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw
}

export function extractSourceAttribution(
  sourcePage: unknown,
  originalCampaign: unknown,
  sourceMetadata: unknown,
  originalAdvisorSlug?: unknown,
): DiagnosticSourceAttribution {
  const meta = asRecord(sourceMetadata)
  return {
    sourcePage: asTrimmedString(sourcePage),
    utmSource: asTrimmedString(meta.utmSource ?? meta.utm_source),
    utmMedium: asTrimmedString(meta.utmMedium ?? meta.utm_medium),
    utmCampaign: asTrimmedString(meta.utmCampaign ?? meta.utm_campaign),
    referrerHost: safeHostFromReferrer(meta.referrer ?? meta.referrerUrl ?? meta.referrer_url),
    originalCampaign: asTrimmedString(originalCampaign),
    originalAdvisorSlug: asTrimmedString(originalAdvisorSlug),
  }
}

export function mapLeadSummary(leadRow: Record<string, unknown> | null): DiagnosticLeadSummary | null {
  if (!leadRow || typeof leadRow.id !== 'string') return null
  const advisor = leadRow.assigned_advisor
  let assignedAdvisorName: string | null = null
  if (advisor && typeof advisor === 'object' && !Array.isArray(advisor)) {
    assignedAdvisorName = asTrimmedString((advisor as Record<string, unknown>).display_name)
  } else if (Array.isArray(advisor) && advisor[0] && typeof advisor[0] === 'object') {
    assignedAdvisorName = asTrimmedString((advisor[0] as Record<string, unknown>).display_name)
  }

  return {
    leadId: leadRow.id,
    leadStatus: asTrimmedString(leadRow.status) ?? 'new',
    ingestMatchStatus: normalizeMatchStatus(leadRow.ingest_match_status),
    duplicateReviewStatus: normalizeDuplicateReviewStatus(leadRow.duplicate_review_status),
    sheetsSyncStatus: normalizeSheetsSyncStatus(leadRow.sheets_sync_status),
    assignedAdvisorName,
    consent: parseConsentSnapshot(leadRow.consent_snapshot),
    submittedAt: asTrimmedString(leadRow.submitted_at),
    source: extractSourceAttribution(
      leadRow.source_page,
      leadRow.original_campaign,
      leadRow.original_source_metadata,
      leadRow.original_advisor_slug,
    ),
  }
}

export function mapPublicFamilyDiagnosticListItem(
  row: Record<string, unknown>,
  options: { householdId: string; isLatest: boolean; lead?: Record<string, unknown> | null },
): PublicFamilyDiagnosticListItem | null {
  if (typeof row.id !== 'string') return null
  if (row.deleted_at != null && row.deleted_at !== '') return null
  if (!isPublicReportCardAssessmentType(row.assessment_type)) return null
  if (row.capture_channel !== 'public_self_report') return null
  if (row.status != null && row.status !== 'completed') return null
  const completedAt = asTrimmedString(row.completed_at)
  if (!completedAt) return null

  const lead = options.lead ?? null
  const consent = lead ? parseConsentSnapshot(lead.consent_snapshot) : null

  const derived = asRecord(row.derived_metrics)
  return {
    assessmentId: row.id,
    householdId: options.householdId,
    productLabel: crmProductLabelForAssessment(row.assessment_type),
    assessmentType: row.assessment_type,
    overallScore: scoreNumber(row.overall_score),
    overallGrade: asTrimmedString(row.overall_grade),
    protectionGapFormatted: asTrimmedString(derived.protectionGapFormatted),
    completedAt,
    scoringVersion: scoreNumber(row.scoring_version),
    topPriorities: extractTopPriorityTitles(row.priorities, row.answers, 3),
    contactPermission: consent ? consent.contactPermission : null,
    sheetsSyncStatus: lead ? normalizeSheetsSyncStatus(lead.sheets_sync_status) : null,
    ingestMatchStatus: lead ? normalizeMatchStatus(lead.ingest_match_status) : null,
    leadId: typeof row.lead_id === 'string' ? row.lead_id : lead?.id && typeof lead.id === 'string' ? lead.id : null,
    isLatest: options.isLatest,
  }
}

export function mapPublicFamilyDiagnosticDetail(
  row: Record<string, unknown>,
  householdId: string,
  lead: Record<string, unknown> | null,
): PublicFamilyDiagnosticDetail | null {
  const list = mapPublicFamilyDiagnosticListItem(row, { householdId, isLatest: true, lead })
  if (!list) return null

  const derived = asRecord(row.derived_metrics)
  const leadSummary = mapLeadSummary(lead)

  return {
    assessmentId: list.assessmentId,
    householdId,
    productLabel: list.productLabel,
    assessmentType: list.assessmentType,
    overallScore: list.overallScore,
    overallGrade: list.overallGrade,
    protectionGapFormatted: list.protectionGapFormatted,
    completedAt: list.completedAt,
    scoringVersion: list.scoringVersion,
    currentLevel: asTrimmedString(derived.currentLevel),
    categories: extractDiagnosticCategories(row.derived_metrics),
    priorities: extractDiagnosticPriorities(row.priorities, row.answers),
    flags: extractDiagnosticFlags(row.derived_metrics),
    submittedSnapshot: extractSubmittedDiagnosticSnapshot(row.answers),
    submittedAnswers:
      row.assessment_type === 'student_loan' ? extractStudentLoanSubmittedAnswers(row.answers) : [],
    consent: leadSummary?.consent ?? null,
    lead: leadSummary,
  }
}

export function formatDiagnosticSubmittedAt(value: string): string {
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

export function consentSummaryOrEmpty(value: IntakeConsentSummary | null | undefined): IntakeConsentSummary {
  return (
    value ??
    parseConsentSnapshot({})
  )
}
