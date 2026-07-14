import QuestionCard from '../../QuestionCard'
import { RETIREMENT_CTA } from '../../../../constants/homepage'

type StepRetirementWelcomeProps = {
  onBegin: () => void
  onBack?: () => void
}

export default function StepRetirementWelcome({ onBegin, onBack }: StepRetirementWelcomeProps) {
  return (
    <QuestionCard
      title="Start Your Retirement Report Card™"
      description="Answer a focused set of questions about your timeline, savings, income sources, investments, taxes, healthcare, and legacy planning. Most people finish in about 4–6 minutes."
    >
      <p className="funnel-microcopy assessment-note">
        Results are educational estimates based on the information you provide and standard planning
        assumptions. They do not guarantee retirement outcomes.
      </p>
      <div className="welcome-actions">
        <button type="button" className="platform-btn platform-btn-primary" onClick={onBegin}>
          {RETIREMENT_CTA}
        </button>
        {onBack ? (
          <button type="button" className="platform-btn platform-btn-outline" onClick={onBack}>
            Back to Overview
          </button>
        ) : null}
      </div>
    </QuestionCard>
  )
}
