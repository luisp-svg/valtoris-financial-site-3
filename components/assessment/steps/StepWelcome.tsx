import QuestionCard from '../QuestionCard'
import { FAMILY_CTA } from '../../../constants/homepage'

type StepWelcomeProps = {
  onBegin: () => void
  onBack?: () => void
}

export default function StepWelcome({ onBegin, onBack }: StepWelcomeProps) {
  return (
    <QuestionCard
      title="Start Your Family Financial Report Card™"
      description="Answer a few simple questions so we can show where your family stands today."
    >
      <div className="welcome-actions">
        <button type="button" className="platform-btn platform-btn-primary" onClick={onBegin}>
          {FAMILY_CTA}
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
