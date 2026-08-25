import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import YesNoInput from '../../YesNoInput'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
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
  t: ReportCardCopyFn
}

export default function StepCashFlowTax({ answers, onChange, t }: StepCashFlowTaxProps) {
  const acceptsCards = answers.acceptsCardPayments === 'yes'

  return (
    <QuestionCard title={t('ui', 'step4Title')} description={t('helpers', 'step4')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label={t('fields', 'operatingCashFlow')}
          name="operatingCashFlow"
          options={localizedOptions(OPERATING_CASH_FLOW_OPTIONS, t, 'operatingCashFlow')}
          value={answers.operatingCashFlow}
          onChange={(value) => onChange('operatingCashFlow', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'reserveMonths')}
          name="reserveMonths"
          options={localizedOptions(RESERVE_MONTHS_OPTIONS, t, 'reserveMonths')}
          value={answers.reserveMonths}
          onChange={(value) => onChange('reserveMonths', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'revenuePredictability')}
          name="revenuePredictability"
          options={localizedOptions(REVENUE_PREDICTABILITY_OPTIONS, t, 'revenuePredictability')}
          value={answers.revenuePredictability}
          onChange={(value) => onChange('revenuePredictability', value)}
          required
        />

        <YesNoInput
          label={t('fields', 'acceptsCardPayments')}
          name="acceptsCardPayments"
          value={answers.acceptsCardPayments}
          onChange={(value) => onChange('acceptsCardPayments', value)}
          yesLabel={t('answers', 'yes')}
          noLabel={t('answers', 'no')}
          required
        />

        {acceptsCards ? (
          <div className="assessment-subsection">
            <OptionGroup
              label={t('fields', 'cardSalesPercentage')}
              name="cardSalesPercentage"
              options={localizedOptions(CARD_SALES_PERCENTAGE_OPTIONS, t, 'cardSalesPercentage')}
              value={answers.cardSalesPercentage}
              onChange={(value) => onChange('cardSalesPercentage', value)}
              required
            />
            <OptionGroup
              label={t('fields', 'estimatedProcessingRate')}
              name="estimatedProcessingRate"
              options={localizedOptions(
                ESTIMATED_PROCESSING_RATE_OPTIONS,
                t,
                'estimatedProcessingRate',
              )}
              value={answers.estimatedProcessingRate}
              onChange={(value) => onChange('estimatedProcessingRate', value)}
              required
            />
            <OptionGroup
              label={t('fields', 'lastProcessingReview')}
              name="lastProcessingReview"
              options={localizedOptions(LAST_PROCESSING_REVIEW_OPTIONS, t, 'lastProcessingReview')}
              value={answers.lastProcessingReview}
              onChange={(value) => onChange('lastProcessingReview', value)}
              required
            />
          </div>
        ) : null}

        <OptionGroup
          label={t('fields', 'taxPlanning')}
          name="taxPlanning"
          options={localizedOptions(TAX_PLANNING_OPTIONS, t, 'taxPlanning')}
          value={answers.taxPlanning}
          onChange={(value) => onChange('taxPlanning', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'taxBenefitStrategies')}
          name="taxBenefitStrategies"
          options={localizedOptions(TAX_BENEFIT_STRATEGIES_OPTIONS, t, 'taxBenefitStrategies')}
          value={answers.taxBenefitStrategies}
          onChange={(value) => onChange('taxBenefitStrategies', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
