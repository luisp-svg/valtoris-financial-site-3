import type { HouseholdFinancialProgressInput } from '../../types'
import {
  BENEFICIARY_REVIEW_CURRENT_MONTHS,
  CORE_DOCUMENT_ALIASES,
  GUARDIANSHIP_DEPENDENT_RELATIONSHIPS,
  MINOR_AGE_THRESHOLD,
  type CoreDocumentId,
} from './constants'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  if (cleaned === '') return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function nestedString(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): string | null {
  return asString(asRecord(answers?.[section])?.[field])
}

function yesNoFromString(value: string | null): 'yes' | 'no' | null {
  if (value == null) return null
  const normalized = value.toLowerCase().replace(/[_-]/g, ' ')
  if (
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === 'documented' ||
    normalized === 'completed' ||
    normalized === 'exists'
  ) {
    return 'yes'
  }
  if (
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === 'none' ||
    normalized === 'not documented'
  ) {
    return 'no'
  }
  return null
}

function normalizeAlias(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveDocumentId(raw: string): CoreDocumentId | null {
  return CORE_DOCUMENT_ALIASES[normalizeAlias(raw)] ?? null
}

export type DocumentPresence = 'yes' | 'no' | 'conflict' | 'unknown'

export type BeneficiaryReviewLevel = 'current' | 'partial' | 'outdated' | 'not_reviewed' | 'unknown'

export type GuardianshipApplicability = 'applicable' | 'not_applicable' | 'unknown'

export type GuardianshipPlanLevel = 'documented' | 'informal' | 'none' | 'unknown'

export type EstateLegacySignals = {
  documents: Record<CoreDocumentId, DocumentPresence>
  /** True when a generic estate task exists (never proves documents). */
  hasGenericEstateTask: boolean
  /** True when home ownership / wealth signals present without trust evidence. */
  hasNonDocumentTrustHints: boolean

  beneficiaryReview: BeneficiaryReviewLevel
  beneficiaryReviewConflict: boolean
  /** Names/count present without review — never full credit. */
  hasBeneficiaryPresenceOnly: boolean

  guardianshipApplicability: GuardianshipApplicability
  guardianshipPlan: GuardianshipPlanLevel
  applicableDependentCount: number | null

  estateOrganization: 'yes' | 'no' | 'conflict' | 'unknown'
  legacyInstructions: 'yes' | 'no' | 'conflict' | 'unknown'
  /**
   * Stated legacy intent (e.g. strong/moderate). Informational only —
   * never establishes documented legacy/final-wish instructions.
   */
  legacyIntent: string | null
  /** Whether input.asOf was provided (required for DOB-based minor determination). */
  asOfProvided: boolean
  referenceDateIso: string
}

function collectYesNoVotes(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): Array<'yes' | 'no'> {
  const votes: Array<'yes' | 'no'> = []
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = yesNoFromString(asString(source[key]))
      if (direct) votes.push(direct)
      if (typeof source[key] === 'boolean') {
        votes.push(source[key] ? 'yes' : 'no')
      }
      for (const section of ['estate', 'protection', 'financial', 'family']) {
        const nested = asRecord(source[section])
        if (!nested) continue
        const value = yesNoFromString(asString(nested[key]))
        if (value) votes.push(value)
        if (typeof nested[key] === 'boolean') {
          votes.push(nested[key] ? 'yes' : 'no')
        }
      }
    }
  }
  return votes
}

function resolvePresence(votes: Array<'yes' | 'no'>): DocumentPresence {
  if (votes.length === 0) return 'unknown'
  const hasYes = votes.includes('yes')
  const hasNo = votes.includes('no')
  if (hasYes && hasNo) return 'conflict'
  if (hasYes) return 'yes'
  return 'no'
}

function documentsFromBundle(
  sources: Array<Record<string, unknown> | null | undefined>,
): Partial<Record<CoreDocumentId, 'yes'>> {
  const found: Partial<Record<CoreDocumentId, 'yes'>> = {}
  for (const source of sources) {
    if (!source) continue
    const bundles = [
      source.estatePlanDocuments,
      source.estate_plan_documents,
      source.coreEstateDocuments,
      asRecord(source.estate)?.documents,
      asRecord(source.estate)?.estatePlanDocuments,
    ]
    for (const bundle of bundles) {
      if (!Array.isArray(bundle)) continue
      for (const item of bundle) {
        if (typeof item !== 'string') continue
        const id = resolveDocumentId(item)
        if (id) found[id] = 'yes'
      }
    }
  }
  return found
}

function ageFromDateOfBirth(dateOfBirth: string, asOfIso: string): number | null {
  const birth = new Date(dateOfBirth)
  const asOf = new Date(asOfIso)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) return null
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear()
  const monthDelta = asOf.getUTCMonth() - birth.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < birth.getUTCDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}

function monthsBetween(earlierIso: string, laterIso: string): number | null {
  const earlier = new Date(earlierIso)
  const later = new Date(laterIso)
  if (Number.isNaN(earlier.getTime()) || Number.isNaN(later.getTime())) return null
  if (earlier.getTime() > later.getTime()) return null
  const years = later.getUTCFullYear() - earlier.getUTCFullYear()
  const months = later.getUTCMonth() - earlier.getUTCMonth()
  const days = later.getUTCDate() - earlier.getUTCDate()
  let total = years * 12 + months
  if (days < 0) total -= 1
  return total
}

function firstString(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: readonly string[],
): string | null {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = asString(source[key])
      if (direct) return direct
      for (const section of ['estate', 'protection', 'financial']) {
        const nested = asString(asRecord(source[section])?.[key])
        if (nested) return nested
      }
    }
  }
  return null
}

/**
 * Extracts Estate & Legacy signals. Normalizes aliases; does not score points.
 */
export function extractEstateLegacySignals(
  input: HouseholdFinancialProgressInput,
): EstateLegacySignals {
  const familyAnswers = input.assessments?.family?.answers ?? null
  const retirementAnswers = input.assessments?.retirement?.answers ?? null
  const protectionAnswers = input.assessments?.protection?.answers ?? null
  const sources = [
    input.assessments?.family?.derived_metrics,
    input.assessments?.retirement?.derived_metrics,
    input.assessments?.protection?.derived_metrics,
    familyAnswers,
    retirementAnswers,
    protectionAnswers,
  ]

  const asOfProvided = input.asOf != null && input.asOf.trim() !== ''
  const referenceDateIso = asOfProvided ? input.asOf! : '1970-01-01T00:00:00.000Z'

  const bundleYes = documentsFromBundle(sources)

  const willVotes = collectYesNoVotes(sources, ['hasWill', 'willCompleted', 'has_will', 'will'])
  const poaVotes = collectYesNoVotes(sources, [
    'hasPowerOfAttorney',
    'financialPowerOfAttorney',
    'durablePowerOfAttorney',
    'has_power_of_attorney',
  ])
  const hcVotes = collectYesNoVotes(sources, [
    'healthcareDirective',
    'medicalPowerOfAttorney',
    'advanceDirective',
    'healthcare_directive',
    'medical_power_of_attorney',
  ])
  const trustVotes = collectYesNoVotes(sources, [
    'hasTrust',
    'revocableTrust',
    'has_trust',
    'livingTrust',
  ])

  const documents: Record<CoreDocumentId, DocumentPresence> = {
    will: resolvePresence(willVotes),
    financial_poa: resolvePresence(poaVotes),
    healthcare_directive: resolvePresence(hcVotes),
    trust: resolvePresence(trustVotes),
  }

  // Bundle yes fills unknown only (does not override explicit no/conflict).
  for (const id of Object.keys(bundleYes) as CoreDocumentId[]) {
    if (documents[id] === 'unknown') documents[id] = 'yes'
  }

  const hasGenericEstateTask = (input.openTasks ?? []).some((task) => {
    const title = task.title.toLowerCase()
    return (
      (title.includes('estate') || title.includes('will') || title.includes('trust')) &&
      !title.includes('review beneficiary') &&
      !title.includes('beneficiary review')
    )
  })

  const hasNonDocumentTrustHints =
    firstString(sources, ['homeOwnership', 'ownsHome', 'netWorth']) != null ||
    nestedString(familyAnswers, 'family', 'numberOfChildren') != null

  // --- Beneficiary / ownership review ---
  const reviewStatusRaw = firstString(sources, [
    'beneficiaryReviewStatus',
    'beneficiary_review_status',
    'ownershipReviewStatus',
    'estateBeneficiaryReviewStatus',
  ])
  const beneficiariesReviewed =
    yesNoFromString(
      nestedString(familyAnswers, 'protection', 'beneficiariesReviewed') ??
        nestedString(retirementAnswers, 'estate', 'beneficiariesReviewed') ??
        firstString(sources, ['beneficiariesReviewed', 'beneficiaries_reviewed']),
    )
  const ownershipReviewed = yesNoFromString(
    firstString(sources, ['ownershipReviewed', 'titlingReviewed', 'accountOwnershipReviewed']),
  )

  const reviewDateRaw = firstString(sources, [
    'beneficiaryReviewDate',
    'beneficiary_review_date',
    'lastBeneficiaryReviewDate',
  ])

  let beneficiaryReview: BeneficiaryReviewLevel = 'unknown'
  let beneficiaryReviewConflict = false

  const statusNormalized = reviewStatusRaw?.toLowerCase().replace(/[_]/g, ' ') ?? null
  if (statusNormalized === 'current' || statusNormalized === 'reviewed' || statusNormalized === 'aligned') {
    beneficiaryReview = 'current'
  } else if (
    statusNormalized === 'partial' ||
    statusNormalized === 'limited' ||
    statusNormalized === 'incomplete review'
  ) {
    beneficiaryReview = 'partial'
  } else if (statusNormalized === 'outdated' || statusNormalized === 'stale') {
    beneficiaryReview = 'outdated'
  } else if (
    statusNormalized === 'not reviewed' ||
    statusNormalized === 'never' ||
    statusNormalized === 'no'
  ) {
    beneficiaryReview = 'not_reviewed'
  } else if (reviewDateRaw) {
    const months = monthsBetween(reviewDateRaw, referenceDateIso)
    if (months == null) {
      beneficiaryReview = 'unknown'
    } else if (months <= BENEFICIARY_REVIEW_CURRENT_MONTHS) {
      beneficiaryReview = 'current'
    } else {
      beneficiaryReview = 'outdated'
    }
  } else if (beneficiariesReviewed === 'yes' && ownershipReviewed === 'yes') {
    beneficiaryReview = 'current'
  } else if (beneficiariesReviewed === 'yes' || ownershipReviewed === 'yes') {
    // Assessment "reviewed in last 2–3 years" is treated as current review flag.
    beneficiaryReview = beneficiariesReviewed === 'yes' ? 'current' : 'partial'
  } else if (beneficiariesReviewed === 'no' || ownershipReviewed === 'no') {
    beneficiaryReview = 'not_reviewed'
  }

  if (
    beneficiariesReviewed === 'yes' &&
    (statusNormalized === 'outdated' || statusNormalized === 'not reviewed')
  ) {
    beneficiaryReviewConflict = true
    beneficiaryReview = 'unknown'
  }

  const hasBeneficiaryNames = (input.policies ?? []).some(
    (policy) => asString(policy.beneficiary) != null,
  )
  const beneficiaryCount = parseFiniteNumber(
    firstString(sources, ['beneficiaryCount', 'beneficiary_count']) ??
      sources.reduce<unknown>((_, source) => source?.beneficiaryCount, null),
  )
  const hasBeneficiaryPresenceOnly =
    beneficiaryReview === 'unknown' &&
    (hasBeneficiaryNames || (beneficiaryCount != null && beneficiaryCount > 0))

  // --- Guardianship ---
  // numberOfChildren alone never establishes applicability (ages may be adult).
  const numberOfChildren = parseFiniteNumber(
    nestedString(familyAnswers, 'family', 'numberOfChildren') ??
      firstString(sources, ['numberOfChildren', 'number_of_children']),
  )
  const explicitMinorFlag = yesNoFromString(
    firstString(sources, [
      'hasMinorChildren',
      'has_minor_children',
      'minorChildrenPresent',
      'hasGuardianshipDependents',
    ]),
  )
  const explicitDependentGuardianship = yesNoFromString(
    firstString(sources, [
      'hasDependentRequiringGuardianship',
      'legallyDependentRequiresGuardianship',
      'adultDependentRequiresGuardianship',
    ]),
  )

  let applicableDependentCount: number | null = null
  let guardianshipApplicability: GuardianshipApplicability = 'unknown'

  const memberDependents = (input.household.members ?? []).filter((member) =>
    (GUARDIANSHIP_DEPENDENT_RELATIONSHIPS as readonly string[]).includes(member.relationship),
  )
  const membersWithDob = memberDependents.filter((member) => member.date_of_birth)
  const unknownAgeDependents = memberDependents.some((member) => !member.date_of_birth)
  const needsAsOfForAges = membersWithDob.length > 0

  let minorMembers: typeof memberDependents = []
  let adultOnlyDependents = false
  let dobAgeConflict = false

  if (needsAsOfForAges && !asOfProvided) {
    // DOB-based minor determination requires an injectable reference date.
    guardianshipApplicability = 'unknown'
  } else {
    minorMembers = memberDependents.filter((member) => {
      if (!member.date_of_birth) return false
      const age = ageFromDateOfBirth(member.date_of_birth, referenceDateIso)
      return age != null && age < MINOR_AGE_THRESHOLD
    })
    adultOnlyDependents =
      memberDependents.length > 0 &&
      memberDependents.every((member) => {
        if (!member.date_of_birth) return false
        const age = ageFromDateOfBirth(member.date_of_birth, referenceDateIso)
        return age != null && age >= MINOR_AGE_THRESHOLD
      })
  }

  // Explicit minor=yes conflicting with all-adult DOBs → incomplete applicability.
  if (explicitMinorFlag === 'yes' && adultOnlyDependents && minorMembers.length === 0) {
    dobAgeConflict = true
  }
  if (explicitMinorFlag === 'no' && minorMembers.length > 0) {
    dobAgeConflict = true
  }

  if (dobAgeConflict || (needsAsOfForAges && !asOfProvided)) {
    guardianshipApplicability = 'unknown'
  } else if (
    explicitMinorFlag === 'no' ||
    (numberOfChildren != null && numberOfChildren === 0 && explicitDependentGuardianship !== 'yes') ||
    (adultOnlyDependents && explicitDependentGuardianship !== 'yes' && explicitMinorFlag !== 'yes')
  ) {
    if (
      explicitMinorFlag === 'yes' ||
      explicitDependentGuardianship === 'yes' ||
      minorMembers.length > 0
    ) {
      guardianshipApplicability = 'unknown'
    } else {
      guardianshipApplicability = 'not_applicable'
      applicableDependentCount = 0
    }
  } else if (
    minorMembers.length > 0 ||
    explicitMinorFlag === 'yes' ||
    explicitDependentGuardianship === 'yes'
  ) {
    guardianshipApplicability = 'applicable'
    applicableDependentCount =
      minorMembers.length > 0
        ? minorMembers.length
        : explicitDependentGuardianship === 'yes'
          ? 1
          : null
  } else if (
    unknownAgeDependents ||
    (numberOfChildren != null && numberOfChildren > 0) ||
    memberDependents.length > 0
  ) {
    // Children reported / child relationships without confirmed minor or dependent status.
    guardianshipApplicability = 'unknown'
  } else {
    guardianshipApplicability = 'unknown'
  }

  const guardianDocumented = yesNoFromString(
    nestedString(familyAnswers, 'protection', 'guardianDocumented') ??
      firstString(sources, [
        'guardianDocumented',
        'guardian_documented',
        'legalGuardianDesignated',
        'hasGuardianPlan',
      ]),
  )
  const informalGuardian = yesNoFromString(
    firstString(sources, [
      'informalGuardianPreference',
      'guardianDiscussed',
      'preferredGuardianInformal',
    ]),
  )

  let guardianshipPlan: GuardianshipPlanLevel = 'unknown'
  if (guardianDocumented === 'yes') guardianshipPlan = 'documented'
  else if (informalGuardian === 'yes') guardianshipPlan = 'informal'
  else if (guardianDocumented === 'no') guardianshipPlan = 'none'

  // --- Organization & legacy ---
  const orgVotes = collectYesNoVotes(sources, [
    'estateInformationOrganized',
    'hasEstateInventory',
    'estateDocumentLocationRecorded',
    'secureEstateDocumentVault',
    'accountInventoryDocumented',
    'keyProfessionalContactsDocumented',
  ])
  const legacyVotes = collectYesNoVotes(sources, [
    'hasLetterOfInstruction',
    'finalWishesDocumented',
    'legacyLetterDocumented',
    'digitalAssetInstructions',
    'funeralPreferencesDocumented',
    'hasLegacyInstructions',
    'businessSuccessionInstructions',
    'writtenFamilyGuidance',
  ])

  const estateOrganization = resolvePresence(orgVotes) as EstateLegacySignals['estateOrganization']
  const legacyInstructions = resolvePresence(legacyVotes) as EstateLegacySignals['legacyInstructions']

  // Intent is informational only — never establishes documented instructions.
  const legacyIntent =
    nestedString(retirementAnswers, 'estate', 'legacyIntent') ??
    firstString(sources, ['legacyIntent', 'legacy_intent'])

  return {
    documents,
    hasGenericEstateTask,
    hasNonDocumentTrustHints,
    beneficiaryReview,
    beneficiaryReviewConflict,
    hasBeneficiaryPresenceOnly,
    guardianshipApplicability,
    guardianshipPlan,
    applicableDependentCount,
    estateOrganization,
    legacyInstructions,
    legacyIntent,
    asOfProvided,
    referenceDateIso,
  }
}
