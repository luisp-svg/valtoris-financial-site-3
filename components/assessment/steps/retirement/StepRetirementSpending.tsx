import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import { DEBT_BURDEN_OPTIONS } from '../../retirement/constants'
import { RetirementLifestyleAnswers } from '../../retirement/types'

type StepRetirementSpendingProps = {
  t: ReportCardCopyFn
  lifestyle: RetirementLifestyleAnswers
  onChange: (field: keyof RetirementLifestyleAnswers, value: string) => void
}

export default function StepRetirementSpending({
  t,
  lifestyle,
  onChange,
}: StepRetirementSpendingProps) {
  return (
    <QuestionCard title={t('ui', 'step3Title')} description={t('helpers', 'step3')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label={t('fields', 'currentAnnualGrossIncome')}
          name="currentAnnualGrossIncome"
          value={lifestyle.currentAnnualGrossIncome}
          onChange={(value) => onChange('currentAnnualGrossIncome', value)}
          placeholder={t('placeholders', 'income')}
          required
        />
        <CurrencyInput
          label={t('fields', 'estimatedMonthlyRetirementSpending')}
          name="estimatedMonthlyRetirementSpending"
          value={lifestyle.estimatedMonthlyRetirementSpending}
          onChange={(value) => onChange('estimatedMonthlyRetirementSpending', value)}
          placeholder={t('placeholders', 'spending')}
        />
        <p className="funnel-microcopy assessment-note">{t('helpers', 'spendingFallback')}</p>
        <OptionGroup
          label={t('fields', 'debtBurden')}
          name="debtBurden"
          options={localizedOptions(DEBT_BURDEN_OPTIONS, t, 'debtBurden')}
          value={lifestyle.debtBurden}
          onChange={(value) => onChange('debtBurden', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
