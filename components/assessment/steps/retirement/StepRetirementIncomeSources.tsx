import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import TextInput from '../../TextInput'
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
  household: RetirementHouseholdAnswers
  incomeSources: RetirementIncomeSourceAnswers
  onChange: (field: keyof RetirementIncomeSourceAnswers, value: string) => void
}

export default function StepRetirementIncomeSources({
  household,
  incomeSources,
  onChange,
}: StepRetirementIncomeSourcesProps) {
  const married = isMarried(household)
  const expectsPartTime = incomeSources.expectsPartTimeWork === 'yes'

  return (
    <QuestionCard
      title="Retirement Income Sources"
      description="Estimate the monthly income you expect in retirement (today’s dollars). Guaranteed sources are weighted more heavily than other or temporary income."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <h3 className="assessment-section-heading">Guaranteed Income</h3>
        <p className="funnel-microcopy assessment-note">
          Social Security, pension, and annuity income that is expected to continue for life (or a
          long contractual period).
        </p>
        <CurrencyInput
          label="Estimated Monthly Social Security"
          name="socialSecurityMonthly"
          value={incomeSources.socialSecurityMonthly}
          onChange={(value) => onChange('socialSecurityMonthly', value)}
          placeholder="2,300"
          required
        />
        {married ? (
          <CurrencyInput
            label="Spouse Estimated Monthly Social Security (optional)"
            name="spouseSocialSecurityMonthly"
            value={incomeSources.spouseSocialSecurityMonthly}
            onChange={(value) => onChange('spouseSocialSecurityMonthly', value)}
            placeholder="1,500"
          />
        ) : null}
        <CurrencyInput
          label="Estimated Monthly Pension"
          name="pensionMonthly"
          value={incomeSources.pensionMonthly}
          onChange={(value) => onChange('pensionMonthly', value)}
          placeholder="0"
          required
        />
        <CurrencyInput
          label="Estimated Monthly Annuity Income"
          name="annuityMonthly"
          value={incomeSources.annuityMonthly}
          onChange={(value) => onChange('annuityMonthly', value)}
          placeholder="0"
          required
        />
        <OptionGroup
          label="Have you reviewed an official Social Security estimate?"
          name="socialSecurityEstimateReviewed"
          options={YES_NO_UNSURE_OPTIONS}
          value={incomeSources.socialSecurityEstimateReviewed}
          onChange={(value) => onChange('socialSecurityEstimateReviewed', value)}
          required
        />
        <OptionGroup
          label="Do you understand your pension election options?"
          name="pensionElectionUnderstood"
          options={YES_NO_NA_UNSURE_OPTIONS}
          value={incomeSources.pensionElectionUnderstood}
          onChange={(value) => onChange('pensionElectionUnderstood', value)}
          required
        />
        <OptionGroup
          label="Is survivor continuation coverage in place or planned?"
          name="survivorContinuation"
          options={YES_NO_NA_UNSURE_OPTIONS}
          value={incomeSources.survivorContinuation}
          onChange={(value) => onChange('survivorContinuation', value)}
          required
        />

        <h3 className="assessment-section-heading">Other Expected Income</h3>
        <p className="funnel-microcopy assessment-note">
          Recurring income that may support retirement but is generally less guaranteed than Social
          Security, pension, or annuity payments.
        </p>
        <CurrencyInput
          label="Estimated Monthly Rental Income"
          name="rentalIncomeMonthly"
          value={incomeSources.rentalIncomeMonthly}
          onChange={(value) => onChange('rentalIncomeMonthly', value)}
          placeholder="0"
          required
        />
        <CurrencyInput
          label="Estimated Monthly Business Income"
          name="businessIncomeMonthly"
          value={incomeSources.businessIncomeMonthly}
          onChange={(value) => onChange('businessIncomeMonthly', value)}
          placeholder="0"
          required
        />
        <CurrencyInput
          label="Other Recurring Monthly Income"
          name="otherRecurringIncomeMonthly"
          value={incomeSources.otherRecurringIncomeMonthly}
          onChange={(value) => onChange('otherRecurringIncomeMonthly', value)}
          placeholder="0"
          required
        />

        <h3 className="assessment-section-heading">Temporary / Part-Time Income</h3>
        <p className="funnel-microcopy assessment-note">
          Part-time or consulting income is treated as temporary and is not counted as lifetime
          guaranteed coverage when estimating required nest egg.
        </p>
        <OptionGroup
          label="Do you expect temporary part-time or consulting income in retirement?"
          name="expectsPartTimeWork"
          options={EXPECTS_PART_TIME_OPTIONS}
          value={incomeSources.expectsPartTimeWork}
          onChange={(value) => onChange('expectsPartTimeWork', value)}
          required
        />
        {expectsPartTime ? (
          <>
            <CurrencyInput
              label="Estimated Monthly Part-Time Income"
              name="estimatedMonthlyPartTimeIncome"
              value={incomeSources.estimatedMonthlyPartTimeIncome}
              onChange={(value) => onChange('estimatedMonthlyPartTimeIncome', value)}
              placeholder="800"
              required
            />
            <TextInput
              label="Expected Years of Part-Time Work"
              name="expectedPartTimeWorkYears"
              type="number"
              value={incomeSources.expectedPartTimeWorkYears}
              onChange={(value) => onChange('expectedPartTimeWorkYears', value)}
              placeholder="3"
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
