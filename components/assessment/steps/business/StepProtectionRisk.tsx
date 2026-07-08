import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import {
  CONTINUITY_PLAN_OPTIONS,
  CORE_INSURANCE_OPTIONS,
  KEY_PERSON_BUYSELL_OPTIONS,
  SPECIALIZED_COVERAGE_OPTIONS,
} from '../../business/constants'
import { ProtectionRiskAnswers } from '../../business/types'

type StepProtectionRiskProps = {
  answers: ProtectionRiskAnswers
  onChange: (field: keyof ProtectionRiskAnswers, value: string) => void
}

export default function StepProtectionRisk({ answers, onChange }: StepProtectionRiskProps) {
  return (
    <QuestionCard
      title="Protection & Risk"
      description="Let's assess how well your business protects key people, revenue, and operations."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label="Do you have key person insurance or funded buy-sell agreements?"
          name="keyPersonBuySell"
          options={KEY_PERSON_BUYSELL_OPTIONS}
          value={answers.keyPersonBuySell}
          onChange={(value) => onChange('keyPersonBuySell', value)}
          required
        />
        <OptionGroup
          label="If a key owner were unavailable for 90 days, could operations continue without major disruption?"
          name="continuityPlan"
          options={CONTINUITY_PLAN_OPTIONS}
          value={answers.continuityPlan}
          onChange={(value) => onChange('continuityPlan', value)}
          required
        />
        <OptionGroup
          label="Do you carry adequate general liability and property insurance?"
          name="coreInsurance"
          options={CORE_INSURANCE_OPTIONS}
          value={answers.coreInsurance}
          onChange={(value) => onChange('coreInsurance', value)}
          required
        />
        <OptionGroup
          label="Have you reviewed cyber, E&O, or umbrella coverage relative to your operations?"
          name="specializedCoverage"
          options={SPECIALIZED_COVERAGE_OPTIONS}
          value={answers.specializedCoverage}
          onChange={(value) => onChange('specializedCoverage', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
