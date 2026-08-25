import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  CONTRIBUTION_CONSISTENCY_OPTIONS,
  EMPLOYER_MATCH_OPTIONS,
} from '../../retirement/constants'
import { RetirementSavingsAnswers } from '../../retirement/types'

type StepRetirementSavingsProps = {
  t: ReportCardCopyFn
  savings: RetirementSavingsAnswers
  onChange: (field: keyof RetirementSavingsAnswers, value: string) => void
}

export default function StepRetirementSavings({
  t,
  savings,
  onChange,
}: StepRetirementSavingsProps) {
  return (
    <QuestionCard title={t('ui', 'step4Title')} description={t('helpers', 'step4')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label={t('fields', 'currentRetirementSavings')}
          name="currentRetirementSavings"
          value={savings.currentRetirementSavings}
          onChange={(value) => onChange('currentRetirementSavings', value)}
          placeholder={t('placeholders', 'savings')}
          required
        />
        <CurrencyInput
          label={t('fields', 'monthlyContribution')}
          name="monthlyContribution"
          value={savings.monthlyContribution}
          onChange={(value) => onChange('monthlyContribution', value)}
          placeholder={t('placeholders', 'contribution')}
          required
        />
        <OptionGroup
          label={t('fields', 'employerMatch')}
          name="employerMatch"
          options={localizedOptions(EMPLOYER_MATCH_OPTIONS, t, 'employerMatch')}
          value={savings.employerMatch}
          onChange={(value) => onChange('employerMatch', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'contributionConsistency')}
          name="contributionConsistency"
          options={localizedOptions(
            CONTRIBUTION_CONSISTENCY_OPTIONS,
            t,
            'contributionConsistency',
          )}
          value={savings.contributionConsistency}
          onChange={(value) => onChange('contributionConsistency', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
