import CurrencyInput from '../CurrencyInput'
import OptionGroup from '../../calculator/OptionGroup'
import QuestionCard from '../QuestionCard'
import TextInput from '../TextInput'
import { MONTHLY_CASH_FLOW_OPTIONS, RETIREMENT_CONTRIBUTION_OPTIONS } from '../constants'
import { localizedOptions, type ReportCardCopyFn } from '../reportCardLocale'
import { FinancialAnswers } from '../types'

type StepThreeFinancialProps = {
  answers: FinancialAnswers
  onChange: (field: keyof FinancialAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function StepThreeFinancial({ answers, onChange, t }: StepThreeFinancialProps) {
  return (
    <QuestionCard title={t('ui', 'step3Title')} description={t('helpers', 'step3')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label={t('fields', 'householdIncome')}
          name="householdIncome"
          value={answers.householdIncome}
          onChange={(value) => onChange('householdIncome', value)}
          placeholder={t('placeholders', 'income')}
          required
        />
        <CurrencyInput
          label={t('fields', 'monthlyHousingPayment')}
          name="monthlyHousingPayment"
          value={answers.monthlyHousingPayment}
          onChange={(value) => onChange('monthlyHousingPayment', value)}
          placeholder={t('placeholders', 'housing')}
          required
        />
        <CurrencyInput
          label={t('fields', 'totalDebt')}
          name="totalDebt"
          value={answers.totalDebt}
          onChange={(value) => onChange('totalDebt', value)}
          placeholder={t('placeholders', 'debt')}
          required
        />
        <TextInput
          label={t('fields', 'emergencyFundMonths')}
          name="emergencyFundMonths"
          type="number"
          value={answers.emergencyFundMonths}
          onChange={(value) => onChange('emergencyFundMonths', value)}
          placeholder={t('placeholders', 'emergencyMonths')}
          min={0}
          max={24}
          required
        />
        <OptionGroup
          label={t('fields', 'monthlyCashFlow')}
          name="monthlyCashFlow"
          options={localizedOptions(MONTHLY_CASH_FLOW_OPTIONS, t, 'monthlyCashFlow')}
          value={answers.monthlyCashFlow}
          onChange={(value) => onChange('monthlyCashFlow', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'retirementContribution')}
          name="retirementContribution"
          options={localizedOptions(RETIREMENT_CONTRIBUTION_OPTIONS, t, 'retirementContribution')}
          value={answers.retirementContribution}
          onChange={(value) => onChange('retirementContribution', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
