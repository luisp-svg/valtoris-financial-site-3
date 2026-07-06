import QuestionCard from '../QuestionCard'
import { FAMILY_CTA } from '../../../constants/homepage'

type StepWelcomeProps = {
  onBegin: () => void
}

export default function StepWelcome({ onBegin }: StepWelcomeProps) {
  return (
    <QuestionCard
      title="Start Your Family Financial Report Card™"
      description="Answer a few simple questions so we can show where your family stands today."
    >
      <div className="welcome-actions">
        <button type="button" className="assessment-btn assessment-btn-primary" onClick={onBegin}>
          {FAMILY_CTA}
        </button>
      </div>
    </QuestionCard>
  )
}
