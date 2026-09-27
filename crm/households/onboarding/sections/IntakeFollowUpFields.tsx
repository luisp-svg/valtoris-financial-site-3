import {
  INTAKE_FOLLOW_UP_GROUPS,
  INTAKE_FOLLOW_UP_MAX_LENGTH,
  type IntakeFollowUpAnswers,
  type IntakeFollowUpFieldId,
} from '../intakeFollowUp'
import type { OnboardingSectionId } from '../onboardingSections'

type Props = {
  sectionId: OnboardingSectionId
  answers: IntakeFollowUpAnswers
  readOnly: boolean
  onChange?: (field: IntakeFollowUpFieldId, value: string) => void
}

export default function IntakeFollowUpFields({ sectionId, answers, readOnly, onChange }: Props) {
  const review = sectionId === 'review'
  const groups = INTAKE_FOLLOW_UP_GROUPS.filter((group) =>
    review ? group.fields.some((field) => answers[field.id]?.trim()) : group.section === sectionId,
  )
  if (!groups.length) return null
  return (
    <section className="crm-onboarding-section" aria-label="Additional intake details">
      <h3>Additional intake details</h3>
      <p className="crm-muted">
        Complete the topics relevant to this household during the advisor review. These details
        are optional. Enter estimates or “unknown” when needed; leave unrelated topics blank.
      </p>
      {groups.map((group) => {
        const answered = group.fields.filter((field) => answers[field.id]?.trim()).length
        return (
          <details key={group.id} className="crm-panel" open={review || undefined}>
            <summary>{group.title} · {answered} of {group.fields.length} recorded</summary>
            <p className="crm-muted">{group.description}</p>
            {readOnly || review ? (
              <dl className="crm-client-workspace-info-list">
                {group.fields.filter((field) => !review || answers[field.id]?.trim()).map((field) => (
                  <div key={field.id}>
                    <dt>{field.label}</dt>
                    <dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{answers[field.id] || 'Not recorded'}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="crm-form-grid">
                {group.fields.map((field) => (
                  <label className="crm-field" key={field.id}>
                    {field.label}
                    <textarea
                      name={field.id}
                      value={answers[field.id] ?? ''}
                      maxLength={INTAKE_FOLLOW_UP_MAX_LENGTH}
                      rows={2}
                      disabled={!onChange}
                      onChange={(event) => onChange?.(field.id, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </details>
        )
      })}
    </section>
  )
}
