import type {
  ActionPriority,
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  BENEFICIARY_REVIEW_CURRENT_MONTHS,
  CORE_DOCUMENT_LABELS,
  CORE_DOCUMENT_POINTS,
  ESTATE_LEGACY_CATEGORY_ID,
  ESTATE_LEGACY_CRITERION_LABELS,
  ESTATE_LEGACY_CRITERION_MAX_POINTS,
  SCORED_CORE_DOCUMENT_IDS,
  type CoreDocumentId,
  type EstateLegacyCriterionId,
} from './constants'
import type { EstateLegacySignals } from './extractSignals'

export type EstateLegacyCriterionOutcome = {
  id: EstateLegacyCriterionId
  maxPoints: number
  points: number
  status: CriterionStatus
  explanation: string
}

function toEvidence(outcome: EstateLegacyCriterionOutcome): CriterionEvidence {
  return {
    criterion: ESTATE_LEGACY_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }
}

/**
 * Core Estate Documents (max 4).
 * Will = 2, Financial POA = 1, Healthcare Directive = 1.
 * Trust is never required for full credit and never awards/deducts these points.
 */
export function scoreCoreEstateDocuments(
  signals: EstateLegacySignals,
): EstateLegacyCriterionOutcome {
  const maxPoints = ESTATE_LEGACY_CRITERION_MAX_POINTS.core_estate_documents

  let points = 0
  const documented: string[] = []
  const missing: string[] = []
  const conflicts: string[] = []
  const unknown: string[] = []

  for (const id of SCORED_CORE_DOCUMENT_IDS) {
    const presence = signals.documents[id]
    const label = CORE_DOCUMENT_LABELS[id]
    if (presence === 'yes') {
      points += CORE_DOCUMENT_POINTS[id]
      documented.push(label)
    } else if (presence === 'no') {
      missing.push(label)
    } else if (presence === 'conflict') {
      conflicts.push(label)
      unknown.push(label)
    } else {
      unknown.push(label)
    }
  }

  const trustNote =
    signals.documents.trust === 'yes'
      ? ' A trust was reported as part of the household’s estate planning; trust presence does not substitute for a will, financial power of attorney, or healthcare directive, and is not treated as legally necessary or sufficient.'
      : signals.documents.trust === 'conflict'
        ? ' Conflicting trust evidence was noted but does not affect scored core documents.'
        : ''

  if (points === 0 && missing.length === SCORED_CORE_DOCUMENT_IDS.length) {
    return {
      id: 'core_estate_documents',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `Available data explicitly reports that a will, financial power of attorney, and healthcare directive are not documented (0/4). Document existence is not a determination of legal validity.${trustNote}`,
    }
  }

  if (points === 0 && conflicts.length === 0 && missing.length === 0) {
    const taskNote = signals.hasGenericEstateTask
      ? ' A generic estate-related task alone does not prove documents exist.'
      : ''
    const trustOnlyNote =
      signals.documents.trust === 'yes'
        ? ' A trust was reported, but trust alone does not score core estate documents.'
        : ''
    return {
      id: 'core_estate_documents',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: will, financial power of attorney, and healthcare directive statuses are unknown.${taskNote}${trustOnlyNote}`,
    }
  }

  if (points === 0 && conflicts.length > 0 && documented.length === 0 && missing.length === 0) {
    return {
      id: 'core_estate_documents',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: conflicting recorded statuses for ${conflicts.join(', ')} prevent scoring those documents.${trustNote}`,
    }
  }

  const status: CriterionStatus = points >= maxPoints ? 'met' : 'partial'
  const conflictNote =
    conflicts.length > 0
      ? ` Conflicting status prevented scoring: ${conflicts.join(', ')}.`
      : ''
  const unknownNote =
    unknown.filter((label) => !conflicts.includes(label)).length > 0
      ? ` Unknown: ${unknown.filter((label) => !conflicts.includes(label)).join(', ')}.`
      : ''

  return {
    id: 'core_estate_documents',
    maxPoints,
    points,
    status,
    explanation: `Documented as reported: ${
      documented.length > 0 ? documented.join(', ') : 'none'
    } (${points}/${maxPoints}). This reflects recorded document presence, not legal validity or sufficiency.${conflictNote}${unknownNote}${trustNote}`,
  }
}

/**
 * Beneficiary & Ownership Review (max 2).
 * Presence of beneficiary names/counts is not a review.
 */
export function scoreBeneficiaryOwnershipReview(
  signals: EstateLegacySignals,
): EstateLegacyCriterionOutcome {
  const maxPoints = ESTATE_LEGACY_CRITERION_MAX_POINTS.beneficiary_ownership_review

  if (signals.beneficiaryReviewConflict) {
    return {
      id: 'beneficiary_ownership_review',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: beneficiary/ownership review statuses conflict, so review currency cannot be scored.',
    }
  }

  if (signals.beneficiaryReview === 'current') {
    return {
      id: 'beneficiary_ownership_review',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `Beneficiary and/or ownership review is documented as current (within ${BENEFICIARY_REVIEW_CURRENT_MONTHS} months or an authoritative current-review status) (2/2).`,
    }
  }

  if (signals.beneficiaryReview === 'partial' || signals.beneficiaryReview === 'outdated') {
    return {
      id: 'beneficiary_ownership_review',
      maxPoints,
      points: 1,
      status: 'partial',
      explanation:
        signals.beneficiaryReview === 'outdated'
          ? 'Beneficiary/ownership review is recorded but outdated relative to the approved review window (1/2).'
          : 'A limited or partial beneficiary/ownership review is documented (1/2).',
    }
  }

  if (signals.beneficiaryReview === 'not_reviewed') {
    return {
      id: 'beneficiary_ownership_review',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation:
        'Available data explicitly reports that beneficiary designations and ownership have not been reviewed (0/2).',
    }
  }

  if (signals.hasBeneficiaryPresenceOnly) {
    return {
      id: 'beneficiary_ownership_review',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Beneficiary names or counts are recorded, but that alone does not confirm a beneficiary and ownership review (0/2).',
    }
  }

  return {
    id: 'beneficiary_ownership_review',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: confirm when beneficiary designations and ownership were last reviewed.',
  }
}

/**
 * Guardianship Planning (max 2).
 * not_applicable when no applicable dependents are affirmatively established.
 */
export function scoreGuardianshipPlanning(
  signals: EstateLegacySignals,
): EstateLegacyCriterionOutcome {
  const maxPoints = ESTATE_LEGACY_CRITERION_MAX_POINTS.guardianship_planning

  if (signals.guardianshipApplicability === 'not_applicable') {
    return {
      id: 'guardianship_planning',
      maxPoints,
      points: 0,
      status: 'not_applicable',
      explanation:
        'No minor children or guardianship-dependent household members are indicated by available data. Criterion contributes 0 of 2 points without redistribution.',
    }
  }

  if (signals.guardianshipApplicability === 'unknown') {
    return {
      id: 'guardianship_planning',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: confirm whether guardianship planning applies to the household. Unknown ages do not establish not-applicable status.',
    }
  }

  if (signals.guardianshipPlan === 'documented') {
    return {
      id: 'guardianship_planning',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `Guardianship preferences are documented for applicable dependents (${
        signals.applicableDependentCount ?? 'known'
      }) (2/2). This reflects recorded planning, not a legal determination.`,
    }
  }

  if (signals.guardianshipPlan === 'informal') {
    return {
      id: 'guardianship_planning',
      maxPoints,
      points: 1,
      status: 'partial',
      explanation:
        'An informal guardian preference is recorded, but formal documentation in estate-planning materials is not confirmed (1/2).',
    }
  }

  if (signals.guardianshipPlan === 'none') {
    return {
      id: 'guardianship_planning',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation:
        'Guardianship planning applies, and available data reports that a guardian plan is not documented (0/2).',
    }
  }

  return {
    id: 'guardianship_planning',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Guardianship planning appears applicable, but planning status is unknown (0/2).',
  }
}

/**
 * Estate Organization & Legacy Instructions (max 2).
 */
export function scoreEstateOrganizationLegacyInstructions(
  signals: EstateLegacySignals,
): EstateLegacyCriterionOutcome {
  const maxPoints = ESTATE_LEGACY_CRITERION_MAX_POINTS.estate_organization_legacy_instructions

  let points = 0
  const parts: string[] = []
  if (signals.estateOrganization === 'yes') {
    points += 1
    parts.push('estate information organization')
  }
  if (signals.legacyInstructions === 'yes') {
    points += 1
    parts.push('legacy/final-wishes instructions')
  }

  const bothExplicitNo =
    signals.estateOrganization === 'no' && signals.legacyInstructions === 'no'
  if (bothExplicitNo) {
    return {
      id: 'estate_organization_legacy_instructions',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation:
        'Available data explicitly reports that estate information organization and legacy instructions are not documented (0/2).',
    }
  }

  const intentNote =
    signals.legacyIntent != null
      ? ` Stated legacy intent (${signals.legacyIntent}) does not by itself establish documented final wishes or instructions.`
      : ''

  if (
    points === 0 &&
    signals.estateOrganization === 'unknown' &&
    signals.legacyInstructions === 'unknown'
  ) {
    return {
      id: 'estate_organization_legacy_instructions',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: estate information organization and legacy/final-wishes instructions are unknown. A will alone, legacy intent, or generic CRM notes do not prove organization or instructions.${intentNote}`,
    }
  }

  if (points === 0) {
    const conflictNote =
      signals.estateOrganization === 'conflict' || signals.legacyInstructions === 'conflict'
        ? ' Conflicting recorded statuses prevented scoring the affected element(s).'
        : ''
    return {
      id: 'estate_organization_legacy_instructions',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data to confirm organized estate information or documented legacy instructions.${conflictNote}${intentNote}`,
    }
  }

  return {
    id: 'estate_organization_legacy_instructions',
    maxPoints,
    points,
    status: points >= maxPoints ? 'met' : 'partial',
    explanation: `Documented elements: ${parts.join(', ')} (${points}/${maxPoints}).${
      signals.legacyIntent != null && signals.legacyInstructions !== 'yes' ? intentNote : ''
    }`,
  }
}

export function scoreAllEstateLegacyCriteria(
  signals: EstateLegacySignals,
): EstateLegacyCriterionOutcome[] {
  return [
    scoreCoreEstateDocuments(signals),
    scoreBeneficiaryOwnershipReview(signals),
    scoreGuardianshipPlanning(signals),
    scoreEstateOrganizationLegacyInstructions(signals),
  ]
}

export function toEstateLegacyEvidence(
  outcomes: readonly EstateLegacyCriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map(toEvidence)
}

function recommendationForCriterion(
  outcome: EstateLegacyCriterionOutcome,
  signals: EstateLegacySignals,
): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  if (outcome.id === 'core_estate_documents') {
    const missingPriority: CoreDocumentId[] = ['will', 'financial_poa', 'healthcare_directive']
    const missing = missingPriority.filter((id) => signals.documents[id] !== 'yes')
    let title = 'Review foundational estate documents'
    let body =
      'Review whether foundational estate-planning documents should be documented with a qualified estate-planning attorney.'
    let actionKey = 'estate.review_core_documents'

    if (missing[0] === 'will' && signals.documents.will !== 'yes') {
      title = 'Review will documentation'
      body =
        'Review whether a will should be documented with a qualified estate-planning attorney.'
      actionKey = 'estate.review_will'
    } else if (missing[0] === 'financial_poa') {
      title = 'Review financial power-of-attorney planning'
      body = 'Review financial power-of-attorney planning.'
      actionKey = 'estate.review_financial_poa'
    } else if (missing[0] === 'healthcare_directive') {
      title = 'Review healthcare directive planning'
      body = 'Review healthcare directive and medical decision-making documents.'
      actionKey = 'estate.review_healthcare_directive'
    }

    // Never auto-recommend a trust merely because it is absent.
    return {
      id: `${ESTATE_LEGACY_CATEGORY_ID}:${actionKey}`,
      categoryId: ESTATE_LEGACY_CATEGORY_ID,
      title,
      body,
      priority: 'medium' as ActionPriority,
      actionKey,
    }
  }

  if (outcome.id === 'estate_organization_legacy_instructions') {
    const orgMissing = signals.estateOrganization !== 'yes'
    const legacyMissing = signals.legacyInstructions !== 'yes'
    let title = 'Organize estate information and document final wishes'
    let body = 'Organize estate information and document final wishes.'
    let actionKey = 'estate.organize_and_document_wishes'
    if (orgMissing && !legacyMissing) {
      title = 'Organize estate information'
      body = 'Create an organized inventory of estate documents, accounts, and key contacts.'
      actionKey = 'estate.organize_information'
    } else if (!orgMissing && legacyMissing) {
      title = 'Document legacy instructions'
      body = signals.legacyIntent
        ? 'Document final wishes and legacy instructions; stated legacy intent alone is not enough.'
        : 'Document final wishes and legacy instructions for the household.'
      actionKey = 'estate.document_legacy_instructions'
    }
    return {
      id: `${ESTATE_LEGACY_CATEGORY_ID}:${actionKey}`,
      categoryId: ESTATE_LEGACY_CATEGORY_ID,
      title,
      body,
      priority: 'medium',
      actionKey,
    }
  }

  const specs: Record<
    'beneficiary_ownership_review' | 'guardianship_planning',
    { title: string; body: string; priority: ActionPriority; actionKey: string }
  > = {
    beneficiary_ownership_review: {
      title:
        outcome.status === 'incomplete'
          ? 'Confirm beneficiary and ownership review timing'
          : outcome.status === 'unmet'
            ? 'Review beneficiary designations and ownership'
            : 'Update beneficiary and ownership records',
      body:
        outcome.status === 'incomplete'
          ? 'Confirm when beneficiary designations and ownership were last reviewed.'
          : outcome.status === 'unmet'
            ? 'Review beneficiary designations and account ownership for alignment with current wishes.'
            : 'Update beneficiary and ownership records after major life changes.',
      priority: 'medium',
      actionKey:
        outcome.status === 'incomplete'
          ? 'estate.confirm_beneficiary_review'
          : outcome.status === 'unmet'
            ? 'estate.review_beneficiaries_ownership'
            : 'estate.update_beneficiaries_ownership',
    },
    guardianship_planning: {
      title:
        outcome.status === 'incomplete'
          ? 'Confirm guardianship planning applicability'
          : outcome.status === 'unmet'
            ? 'Document guardianship preferences'
            : 'Formalize guardianship preferences',
      body:
        outcome.status === 'incomplete'
          ? 'Confirm whether guardianship planning applies to the household.'
          : outcome.status === 'unmet'
            ? 'Document guardianship preferences for minor children or dependents.'
            : 'Review whether guardianship preferences should be formally included in estate documents.',
      priority: 'high',
      actionKey:
        outcome.status === 'incomplete'
          ? 'estate.confirm_guardianship_applicability'
          : outcome.status === 'unmet'
            ? 'estate.document_guardianship'
            : 'estate.formalize_guardianship',
    },
  }

  const spec = specs[outcome.id]
  return {
    id: `${ESTATE_LEGACY_CATEGORY_ID}:${spec.actionKey}`,
    categoryId: ESTATE_LEGACY_CATEGORY_ID,
    title: spec.title,
    body: spec.body,
    priority: spec.priority,
    actionKey: spec.actionKey,
  }
}

export function buildEstateLegacyRecommendations(
  outcomes: readonly EstateLegacyCriterionOutcome[],
  signals: EstateLegacySignals,
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const seenKeys = new Set<string>()
  for (const outcome of outcomes) {
    const recommendation = recommendationForCriterion(outcome, signals)
    if (!recommendation) continue
    if (seenKeys.has(recommendation.actionKey)) continue
    seenKeys.add(recommendation.actionKey)
    recommendations.push(recommendation)
  }
  return recommendations
}

/**
 * Scorable: met | partial | unmet
 * Non-scorable: incomplete | not_applicable
 * Guardianship N/A alone does not unlock a computed category score.
 */
export function summarizeEstateLegacyScore(
  outcomes: readonly EstateLegacyCriterionOutcome[],
): {
  score: number | null
  status: 'computed' | 'insufficient_data'
  summary: string
} {
  const hasScorableEvidence = outcomes.some(
    (outcome) =>
      outcome.status === 'met' ||
      outcome.status === 'partial' ||
      outcome.status === 'unmet',
  )

  if (outcomes.length === 0 || !hasScorableEvidence) {
    return {
      score: null,
      status: 'insufficient_data',
      summary:
        'Estate & Legacy: insufficient data to score criteria. Record estate documents, beneficiary review, guardianship applicability, and organization details.',
    }
  }

  const earned = Math.min(
    10,
    outcomes.reduce((sum, outcome) => sum + outcome.points, 0),
  )
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const notApplicable = outcomes.filter((outcome) => outcome.status === 'not_applicable').length
  const partial = outcomes.filter((outcome) => outcome.status === 'partial').length

  const parts = [`Estate & Legacy scored ${earned} of ${available} points.`]
  if (notApplicable > 0) {
    parts.push(
      `${notApplicable} criterion(ia) not applicable (0 points; points are not redistributed).`,
    )
  }
  if (incomplete > 0) {
    parts.push(`${incomplete} criterion(ia) incomplete due to missing data.`)
  }
  if (partial > 0) {
    parts.push(`${partial} criterion(ia) partial.`)
  }

  return {
    score: earned,
    status: 'computed',
    summary: parts.join(' '),
  }
}
