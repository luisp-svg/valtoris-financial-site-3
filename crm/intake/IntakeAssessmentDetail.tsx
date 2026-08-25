import PublicFamilyDiagnosticDetailView from '../households/assessments/PublicFamilyDiagnosticDetailView'
import type { IntakeQueueItem } from './types'
import {
  INTAKE_MISSING_ASSESSMENT_COPY,
  intakeAssessmentDetailKind,
} from './intakeAssessmentMatch'

type Props = {
  item: IntakeQueueItem
}

/**
 * Dispatches Intake diagnostic display by assessment_type.
 * Reuses the household public-report-card detail renderer. Digital Identity
 * is lead-only and must not render an empty assessment.
 */
export default function IntakeAssessmentDetail({ item }: Props) {
  const kind = intakeAssessmentDetailKind(item)
  if (kind === 'digital_identity') return null

  if (kind === 'missing' || !item.assessmentDetail) {
    return (
      <p className="crm-muted" role="status">
        {INTAKE_MISSING_ASSESSMENT_COPY}
      </p>
    )
  }

  return (
    <PublicFamilyDiagnosticDetailView
      detail={item.assessmentDetail}
      variant="embedded"
    />
  )
}
