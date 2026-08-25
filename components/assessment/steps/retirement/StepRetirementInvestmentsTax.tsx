import ChoiceGroup from '../../ChoiceGroup'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  ALLOCATION_REVIEW_OPTIONS,
  DIVERSIFICATION_OPTIONS,
  RETIREMENT_ACCOUNT_TYPE_OPTIONS,
  RISK_TOLERANCE_OPTIONS,
  ROTH_USAGE_OPTIONS,
  TAX_PLANNING_OPTIONS,
} from '../../retirement/constants'
import { RetirementInvestmentAnswers, RetirementTaxAnswers } from '../../retirement/types'

type StepRetirementInvestmentsTaxProps = {
  t: ReportCardCopyFn
  investments: RetirementInvestmentAnswers
  tax: RetirementTaxAnswers
  onInvestmentsChange: (field: keyof RetirementInvestmentAnswers, value: string) => void
  onTaxChange: (field: keyof RetirementTaxAnswers, value: string) => void
  onAccountTypesChange: (selected: string[]) => void
}

export default function StepRetirementInvestmentsTax({
  t,
  investments,
  tax,
  onInvestmentsChange,
  onTaxChange,
  onAccountTypesChange,
}: StepRetirementInvestmentsTaxProps) {
  return (
    <QuestionCard title={t('ui', 'step7Title')} description={t('helpers', 'step7')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <h3 className="assessment-section-heading">{t('fields', 'investmentsHeading')}</h3>
        <OptionGroup
          label={t('fields', 'riskTolerance')}
          name="riskTolerance"
          options={localizedOptions(RISK_TOLERANCE_OPTIONS, t, 'riskTolerance')}
          value={investments.riskTolerance}
          onChange={(value) => onInvestmentsChange('riskTolerance', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'diversification')}
          name="diversification"
          options={localizedOptions(DIVERSIFICATION_OPTIONS, t, 'diversification')}
          value={investments.diversification}
          onChange={(value) => onInvestmentsChange('diversification', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'allocationReview')}
          name="allocationReview"
          options={localizedOptions(ALLOCATION_REVIEW_OPTIONS, t, 'allocationReview')}
          value={investments.allocationReview}
          onChange={(value) => onInvestmentsChange('allocationReview', value)}
          required
        />

        <h3 className="assessment-section-heading">{t('fields', 'taxHeading')}</h3>
        <ChoiceGroup
          label={t('fields', 'accountTypes')}
          name="accountTypes"
          options={localizedOptions(RETIREMENT_ACCOUNT_TYPE_OPTIONS, t, 'accountTypes')}
          selected={tax.accountTypes}
          onChange={onAccountTypesChange}
          required
        />
        <OptionGroup
          label={t('fields', 'taxPlanning')}
          name="taxPlanning"
          options={localizedOptions(TAX_PLANNING_OPTIONS, t, 'taxPlanning')}
          value={tax.taxPlanning}
          onChange={(value) => onTaxChange('taxPlanning', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'rothUsage')}
          name="rothUsage"
          options={localizedOptions(ROTH_USAGE_OPTIONS, t, 'rothUsage')}
          value={tax.rothUsage}
          onChange={(value) => onTaxChange('rothUsage', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
