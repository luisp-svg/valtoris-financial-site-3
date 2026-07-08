import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import YesNoInput from '../../YesNoInput'
import {
  CARD_SALES_PERCENTAGE_OPTIONS,
  ESTIMATED_PROCESSING_RATE_OPTIONS,
  LAST_PROCESSING_REVIEW_OPTIONS,
  OPERATING_CASH_FLOW_OPTIONS,
  RESERVE_MONTHS_OPTIONS,
  REVENUE_PREDICTABILITY_OPTIONS,
  TAX_BENEFIT_STRATEGIES_OPTIONS,
  TAX_PLANNING_OPTIONS,
} from '../../business/constants'
import { CashFlowTaxAnswers } from '../../business/types'

type StepCashFlowTaxProps = {
  answers: CashFlowTaxAnswers
  onChange: (field: keyof CashFlowTaxAnswers, value: string) => void
}

export default function StepCashFlowTax({ answers, onChange }: StepCashFlowTaxProps) {
  const acceptsCards = answers.acceptsCardPayments === 'yes'

  return (
    <QuestionCard
      title="Cash Flow & Tax Strategy"
      description="Operating liquidity, payment processing awareness, and tax planning."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label="How would you describe your business operating cash flow?"
          name="operatingCashFlow"
          options={OPERATING_CASH_FLOW_OPTIONS}
          value={answers.operatingCashFlow}
          onChange={(value) => onChange('operatingCashFlow', value)}
          required
        />
        <OptionGroup
          label="How many months of operating expenses do you keep in business reserves?"
          name="reserveMonths"
          options={RESERVE_MONTHS_OPTIONS}
          value={answers.reserveMonths}
          onChange={(value) => onChange('reserveMonths', value)}
          required
        />
        <OptionGroup
          label="How predictable is your revenue?"
          name="revenuePredictability"
          options={REVENUE_PREDICTABILITY_OPTIONS}
          value={answers.revenuePredictability}
          onChange={(value) => onChange('revenuePredictability', value)}
          required
        />

        <YesNoInput
          label="Does your business accept credit or debit card payments?"
          name="acceptsCardPayments"
          value={answers.acceptsCardPayments}
          onChange={(value) => onChange('acceptsCardPayments', value)}
          required
        />

        {acceptsCards ? (
          <div className="assessment-subsection">
            <OptionGroup
              label="Approximately what percentage of your sales are paid by card?"
              name="cardSalesPercentage"
              options={CARD_SALES_PERCENTAGE_OPTIONS}
              value={answers.cardSalesPercentage}
              onChange={(value) => onChange('cardSalesPercentage', value)}
              required
            />
            <OptionGroup
              label="What is your estimated effective credit card processing rate?"
              name="estimatedProcessingRate"
              options={ESTIMATED_PROCESSING_RATE_OPTIONS}
              value={answers.estimatedProcessingRate}
              onChange={(value) => onChange('estimatedProcessingRate', value)}
              required
            />
            <OptionGroup
              label="When was your last credit card processing statement review?"
              name="lastProcessingReview"
              options={LAST_PROCESSING_REVIEW_OPTIONS}
              value={answers.lastProcessingReview}
              onChange={(value) => onChange('lastProcessingReview', value)}
              required
            />
          </div>
        ) : null}

        <OptionGroup
          label="How would you describe your business tax planning?"
          name="taxPlanning"
          options={TAX_PLANNING_OPTIONS}
          value={answers.taxPlanning}
          onChange={(value) => onChange('taxPlanning', value)}
          required
        />
        <OptionGroup
          label="Do you use retirement or benefit strategies to reduce business taxes?"
          name="taxBenefitStrategies"
          options={TAX_BENEFIT_STRATEGIES_OPTIONS}
          value={answers.taxBenefitStrategies}
          onChange={(value) => onChange('taxBenefitStrategies', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
