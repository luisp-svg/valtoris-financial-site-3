import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import TextInput from '../../TextInput'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  EXPECTS_PART_TIME_OPTIONS,
  YES_NO_NA_UNSURE_OPTIONS,
  YES_NO_UNSURE_OPTIONS,
} from '../../retirement/constants'
import {
  RetirementHouseholdAnswers,
  RetirementIncomeSourceAnswers,
  isMarried,
} from '../../retirement/types'

type StepRetirementIncomeSourcesProps = {
  t: ReportCardCopyFn
  household: RetirementHouseholdAnswers
  incomeSources: RetirementIncomeSourceAnswers
  onChange: (field: keyof RetirementIncomeSourceAnswers, value: string) => void
}

export default function StepRetirementIncomeSources({
  t,
  household,
  incomeSources,
  onChange,
}: StepRetirementIncomeSourcesProps) {
  const married = isMarried(household)
  const expectsPartTime = incomeSources.expectsPartTimeWork === 'yes'
  const yesNoUnsure = localizedOptions(YES_NO_UNSURE_OPTIONS, t, 'yesNoUnsure')
  const yesNoNaUnsure = localizedOptions(YES_NO_NA_UNSURE_OPTIONS, t, 'yesNoNaUnsure')

  return (
    <QuestionCard title={t('ui', 'step5Title')} description={t('helpers', 'step5')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <h3 className="assessment-section-heading">{t('fields', 'guaranteedIncomeHeading')}</h3>
        <p className="funnel-microcopy assessment-note">{t('helpers', 'guaranteedIncome')}</p>
        <CurrencyInput
          label={t('fields', 'socialSecurityMonthly')}
          name="socialSecurityMonthly"
          value={incomeSources.socialSecurityMonthly}
          onChange={(value) => onChange('socialSecurityMonthly', value)}
          placeholder={t('placeholders', 'socialSecurity')}
          required
        />
        {married ? (
          <CurrencyInput
            label={t('fields', 'spouseSocialSecurityMonthly')}
            name="spouseSocialSecurityMonthly"
            value={incomeSources.spouseSocialSecurityMonthly}
            onChange={(value) => onChange('spouseSocialSecurityMonthly', value)}
            placeholder={t('placeholders', 'spouseSocialSecurity')}
          />
        ) : null}
        <CurrencyInput
          label={t('fields', 'pensionMonthly')}
          name="pensionMonthly"
          value={incomeSources.pensionMonthly}
          onChange={(value) => onChange('pensionMonthly', value)}
          placeholder={t('placeholders', 'zero')}
          required
        />
        <CurrencyInput
          label={t('fields', 'annuityMonthly')}
          name="annuityMonthly"
          value={incomeSources.annuityMonthly}
          onChange={(value) => onChange('annuityMonthly', value)}
          placeholder={t('placeholders', 'zero')}
          required
        />
        <OptionGroup
          label={t('fields', 'socialSecurityEstimateReviewed')}
          name="socialSecurityEstimateReviewed"
          options={yesNoUnsure}
          value={incomeSources.socialSecurityEstimateReviewed}
          onChange={(value) => onChange('socialSecurityEstimateReviewed', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'pensionElectionUnderstood')}
          name="pensionElectionUnderstood"
          options={yesNoNaUnsure}
          value={incomeSources.pensionElectionUnderstood}
          onChange={(value) => onChange('pensionElectionUnderstood', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'survivorContinuation')}
          name="survivorContinuation"
          options={yesNoNaUnsure}
          value={incomeSources.survivorContinuation}
          onChange={(value) => onChange('survivorContinuation', value)}
          required
        />

        <h3 className="assessment-section-heading">{t('fields', 'otherIncomeHeading')}</h3>
        <p className="funnel-microcopy assessment-note">{t('helpers', 'otherIncome')}</p>
        <CurrencyInput
          label={t('fields', 'rentalIncomeMonthly')}
          name="rentalIncomeMonthly"
          value={incomeSources.rentalIncomeMonthly}
          onChange={(value) => onChange('rentalIncomeMonthly', value)}
          placeholder={t('placeholders', 'zero')}
          required
        />
        <CurrencyInput
          label={t('fields', 'businessIncomeMonthly')}
          name="businessIncomeMonthly"
          value={incomeSources.businessIncomeMonthly}
          onChange={(value) => onChange('businessIncomeMonthly', value)}
          placeholder={t('placeholders', 'zero')}
          required
        />
        <CurrencyInput
          label={t('fields', 'otherRecurringIncomeMonthly')}
          name="otherRecurringIncomeMonthly"
          value={incomeSources.otherRecurringIncomeMonthly}
          onChange={(value) => onChange('otherRecurringIncomeMonthly', value)}
          placeholder={t('placeholders', 'zero')}
          required
        />

        <h3 className="assessment-section-heading">{t('fields', 'partTimeIncomeHeading')}</h3>
        <p className="funnel-microcopy assessment-note">{t('helpers', 'partTimeIncome')}</p>
        <OptionGroup
          label={t('fields', 'expectsPartTimeWork')}
          name="expectsPartTimeWork"
          options={localizedOptions(EXPECTS_PART_TIME_OPTIONS, t, 'expectsPartTime')}
          value={incomeSources.expectsPartTimeWork}
          onChange={(value) => onChange('expectsPartTimeWork', value)}
          required
        />
        {expectsPartTime ? (
          <>
            <CurrencyInput
              label={t('fields', 'estimatedMonthlyPartTimeIncome')}
              name="estimatedMonthlyPartTimeIncome"
              value={incomeSources.estimatedMonthlyPartTimeIncome}
              onChange={(value) => onChange('estimatedMonthlyPartTimeIncome', value)}
              placeholder={t('placeholders', 'partTimeIncome')}
              required
            />
            <TextInput
              label={t('fields', 'expectedPartTimeWorkYears')}
              name="expectedPartTimeWorkYears"
              type="number"
              value={incomeSources.expectedPartTimeWorkYears}
              onChange={(value) => onChange('expectedPartTimeWorkYears', value)}
              placeholder={t('placeholders', 'partTimeYears')}
              min={0}
              max={40}
              required
            />
          </>
        ) : null}
      </form>
    </QuestionCard>
  )
}
