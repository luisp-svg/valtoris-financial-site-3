import CurrencyInput from '../CurrencyInput'
import QuestionCard from '../QuestionCard'
import YesNoInput from '../YesNoInput'
import { ProtectionAnswers } from '../types'

type StepFourProtectionProps = {
  answers: ProtectionAnswers
  onChange: (field: keyof ProtectionAnswers, value: string) => void
}

export default function StepFourProtection({ answers, onChange }: StepFourProtectionProps) {
  return (
    <QuestionCard
      title="Protection & Legacy"
      description="Let's review how prepared your family is for life's unexpected moments."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label="Current Life Insurance"
          name="currentLifeInsurance"
          value={answers.currentLifeInsurance}
          onChange={(value) => onChange('currentLifeInsurance', value)}
          placeholder="250,000"
          required
        />
        <YesNoInput
          label="Has Will?"
          name="hasWill"
          value={answers.hasWill}
          onChange={(value) => onChange('hasWill', value)}
          required
        />
        <YesNoInput
          label="Has Trust?"
          name="hasTrust"
          value={answers.hasTrust}
          onChange={(value) => onChange('hasTrust', value)}
          required
        />
        <YesNoInput
          label="Beneficiaries Reviewed?"
          name="beneficiariesReviewed"
          value={answers.beneficiariesReviewed}
          onChange={(value) => onChange('beneficiariesReviewed', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
