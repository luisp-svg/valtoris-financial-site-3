import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import {
  CONTRIBUTION_CONSISTENCY_OPTIONS,
  EMPLOYER_MATCH_OPTIONS,
} from '../../retirement/constants'
import { RetirementSavingsAnswers } from '../../retirement/types'

type StepRetirementSavingsProps = {
  savings: RetirementSavingsAnswers
  onChange: (field: keyof RetirementSavingsAnswers, value: string) => void
}

export default function StepRetirementSavings({ savings, onChange }: StepRetirementSavingsProps) {
  return (
    <QuestionCard
      title="Retirement Savings"
      description="Tell us about your current retirement balances and contribution habits."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label="Current Retirement Savings (all accounts)"
          name="currentRetirementSavings"
          value={savings.currentRetirementSavings}
          onChange={(value) => onChange('currentRetirementSavings', value)}
          placeholder="320,000"
          required
        />
        <CurrencyInput
          label="Monthly Retirement Contribution"
          name="monthlyContribution"
          value={savings.monthlyContribution}
          onChange={(value) => onChange('monthlyContribution', value)}
          placeholder="900"
          required
        />
        <OptionGroup
          label="Do you receive an employer retirement match?"
          name="employerMatch"
          options={EMPLOYER_MATCH_OPTIONS}
          value={savings.employerMatch}
          onChange={(value) => onChange('employerMatch', value)}
          required
        />
        <OptionGroup
          label="How consistently do you contribute?"
          name="contributionConsistency"
          options={CONTRIBUTION_CONSISTENCY_OPTIONS}
          value={savings.contributionConsistency}
          onChange={(value) => onChange('contributionConsistency', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
