import {
  assessmentTypeForLeadType,
  type PublicReportCardAssessmentType,
} from '../../modules/reportCard/publicIngestCatalog'
import { DIGITAL_IDENTITY_LEAD_TYPE } from '../../modules/digital-identity'
import type { IntakeQueueItem } from './types'

export type IntakeAssessmentDetailKind =
  | PublicReportCardAssessmentType
  | 'digital_identity'
  | 'missing'

export const INTAKE_MISSING_ASSESSMENT_COPY =
  'Assessment details are not available for this Intake.'

/**
 * Matching rule for Intake diagnostic rows:
 * 1. assessment.lead_id === current Intake lead
 * 2. assessment_type === assessmentTypeForLeadType(lead_type)
 * 3. if the lead has a household_id, assessment.household_id must match
 * 4. among remaining rows, newest completed_at wins (caller should order DESC)
 *
 * Never selects “latest assessment for household” of any type.
 * Digital Identity has no assessment and always returns null.
 */
export function selectIntakeLinkedAssessment(input: {
  leadId: string
  householdId: string | null
  leadType: string
  assessments: readonly Record<string, unknown>[]
}): Record<string, unknown> | null {
  if (!input.leadId || input.leadType === DIGITAL_IDENTITY_LEAD_TYPE) return null
  const expectedType = assessmentTypeForLeadType(input.leadType)
  if (!expectedType) return null

  for (const row of input.assessments) {
    if (typeof row.id !== 'string' || !row.id) continue
    if (row.lead_id !== input.leadId) continue
    if (row.assessment_type !== expectedType) continue
    if (input.householdId && typeof row.household_id === 'string' && row.household_id !== input.householdId) {
      continue
    }
    if (row.deleted_at != null && row.deleted_at !== '') continue
    if (row.status != null && row.status !== 'completed') continue
    if (row.capture_channel != null && row.capture_channel !== 'public_self_report') continue
    if (typeof row.completed_at !== 'string' || !row.completed_at) continue
    return row
  }
  return null
}

export function intakeAssessmentDetailKind(
  item: Pick<IntakeQueueItem, 'leadType' | 'diagnostic' | 'digitalIdentity' | 'assessmentDetail'>,
): IntakeAssessmentDetailKind {
  if (item.leadType === DIGITAL_IDENTITY_LEAD_TYPE) return 'digital_identity'
  const expected = assessmentTypeForLeadType(item.leadType)
  if (!expected) return 'missing'
  if (!item.diagnostic?.assessmentId || !item.assessmentDetail) return 'missing'
  if (item.assessmentDetail.assessmentType !== expected) return 'missing'
  if (
    item.diagnostic.assessmentType &&
    item.diagnostic.assessmentType !== expected
  ) {
    return 'missing'
  }
  return expected
}

export function intakeAssessmentDetailRenderer(
  kind: IntakeAssessmentDetailKind,
): 'PublicFamilyDiagnosticDetailView' | 'lead_only' | 'empty' {
  if (kind === 'digital_identity') return 'lead_only'
  if (kind === 'missing') return 'empty'
  return 'PublicFamilyDiagnosticDetailView'
}
