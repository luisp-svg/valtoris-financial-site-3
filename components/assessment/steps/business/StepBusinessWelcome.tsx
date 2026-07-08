import QuestionCard from '../../QuestionCard'
import { BUSINESS_CTA } from '../../../../constants/homepage'

type StepBusinessWelcomeProps = {
  onBegin: () => void
}

export default function StepBusinessWelcome({ onBegin }: StepBusinessWelcomeProps) {
  return (
    <QuestionCard
      title="Start Your Business Financial Report Card™"
      description="Answer a focused set of questions so we can diagnose where your business is strong, exposed, and what to fix first."
    >
      <div className="welcome-actions">
        <button type="button" className="assessment-btn assessment-btn-primary" onClick={onBegin}>
          {BUSINESS_CTA}
        </button>
      </div>
    </QuestionCard>
  )
}
