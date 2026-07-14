import ChoiceGroup from '../../ChoiceGroup'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
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
  investments: RetirementInvestmentAnswers
  tax: RetirementTaxAnswers
  onInvestmentsChange: (field: keyof RetirementInvestmentAnswers, value: string) => void
  onTaxChange: (field: keyof RetirementTaxAnswers, value: string) => void
  onAccountTypesChange: (selected: string[]) => void
}

export default function StepRetirementInvestmentsTax({
  investments,
  tax,
  onInvestmentsChange,
  onTaxChange,
  onAccountTypesChange,
}: StepRetirementInvestmentsTaxProps) {
  return (
    <QuestionCard
      title="Investments & Taxes"
      description="Share how you invest today and how your accounts are structured for tax flexibility."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <h3 className="assessment-section-heading">Investment Risk & Diversification</h3>
        <OptionGroup
          label="How would you describe your investment risk tolerance?"
          name="riskTolerance"
          options={RISK_TOLERANCE_OPTIONS}
          value={investments.riskTolerance}
          onChange={(value) => onInvestmentsChange('riskTolerance', value)}
          required
        />
        <OptionGroup
          label="How diversified are your retirement investments?"
          name="diversification"
          options={DIVERSIFICATION_OPTIONS}
          value={investments.diversification}
          onChange={(value) => onInvestmentsChange('diversification', value)}
          required
        />
        <OptionGroup
          label="When did you last formally review your allocation?"
          name="allocationReview"
          options={ALLOCATION_REVIEW_OPTIONS}
          value={investments.allocationReview}
          onChange={(value) => onInvestmentsChange('allocationReview', value)}
          required
        />

        <h3 className="assessment-section-heading">Tax Diversification & Efficiency</h3>
        <ChoiceGroup
          label="Which retirement account types do you currently use?"
          name="accountTypes"
          options={RETIREMENT_ACCOUNT_TYPE_OPTIONS}
          selected={tax.accountTypes}
          onChange={onAccountTypesChange}
          required
        />
        <OptionGroup
          label="How would you describe your tax planning for retirement?"
          name="taxPlanning"
          options={TAX_PLANNING_OPTIONS}
          value={tax.taxPlanning}
          onChange={(value) => onTaxChange('taxPlanning', value)}
          required
        />
        <OptionGroup
          label="How actively do you use Roth contributions or conversions?"
          name="rothUsage"
          options={ROTH_USAGE_OPTIONS}
          value={tax.rothUsage}
          onChange={(value) => onTaxChange('rothUsage', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
