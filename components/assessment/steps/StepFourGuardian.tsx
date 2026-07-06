import QuestionCard from '../QuestionCard'
import YesNoInput from '../YesNoInput'
import { ProtectionAnswers } from '../types'

type StepFourGuardianProps = {
  answers: ProtectionAnswers
  onChange: (field: keyof ProtectionAnswers, value: string) => void
}

export default function StepFourGuardian({ answers, onChange }: StepFourGuardianProps) {
  return (
    <QuestionCard
      title="Guardianship Planning"
      description="Because you reported dependents, we need one more estate planning detail."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <YesNoInput
          label="Have you documented guardianship preferences for your children in your estate plan?"
          name="guardianDocumented"
          value={answers.guardianDocumented}
          onChange={(value) => onChange('guardianDocumented', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
