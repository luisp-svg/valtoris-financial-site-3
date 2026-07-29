import {
  type HouseholdOnboardingAnswers,
  type OnboardingCashFlowAnswers,
} from '../onboardingFormTypes'
import { formatCentsCurrency } from '../onboardingMoney'
import type { OnboardingSectionConfig } from '../onboardingSections'
import {
  CASH_FLOW_EXPENSE_KEYS,
  computeCashFlowTotals,
  validateCashFlowSection,
} from '../onboardingValidation'
import MoneyField from './MoneyField'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeCashFlow: (
    cashFlow:
      | OnboardingCashFlowAnswers
      | ((prev: OnboardingCashFlowAnswers) => OnboardingCashFlowAnswers),
  ) => void
}

const EXPENSE_LABELS: Record<(typeof CASH_FLOW_EXPENSE_KEYS)[number], string> = {
  housingCents: 'Housing',
  utilitiesCents: 'Utilities',
  transportationCents: 'Transportation',
  foodCents: 'Food',
  childcareCents: 'Childcare',
  insurancePremiumsCents: 'Insurance premiums',
  debtPaymentsCents: 'Debt payments',
  medicalCents: 'Medical expenses',
  subscriptionsCents: 'Subscriptions',
  discretionaryCents: 'Discretionary spending',
  otherFixedCents: 'Other fixed expenses',
  otherVariableCents: 'Other variable expenses',
}

export default function CashFlowSection({
  section,
  answers,
  readOnly,
  onChangeCashFlow,
}: Props) {
  const cashFlow = answers.cashFlow
  const validation = validateCashFlowSection(answers)
  const totals = computeCashFlowTotals(cashFlow)

  function patch(partial: Partial<OnboardingCashFlowAnswers>) {
    onChangeCashFlow((prev) => ({ ...prev, ...partial }))
  }

  function toggleUnknown(key: string) {
    const set = new Set(cashFlow.unknownCategories)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    patch({ unknownCategories: [...set] })
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <SectionValidationSummary result={validation} />

      <MoneyField
        label="Monthly take-home income"
        name="takeHomeIncome"
        required
        disabled={readOnly}
        value={cashFlow.takeHomeIncomeCents}
        onChange={(cents) => patch({ takeHomeIncomeCents: cents })}
        hint="Blank means unknown. Explicit 0 is allowed."
      />

      <div className="crm-onboarding-form-grid">
        {CASH_FLOW_EXPENSE_KEYS.map((key) => (
          <div key={key} className="crm-onboarding-expense-field">
            <MoneyField
              label={EXPENSE_LABELS[key]}
              name={key}
              disabled={readOnly || cashFlow.unknownCategories.includes(key)}
              value={cashFlow[key]}
              onChange={(cents) => patch({ [key]: cents })}
            />
            <label className="crm-field crm-onboarding-checkbox">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={cashFlow.unknownCategories.includes(key)}
                onChange={() => toggleUnknown(key)}
              />
              Unknown / not applicable
            </label>
          </div>
        ))}
      </div>

      <dl className="crm-client-workspace-info-list">
        <div>
          <dt>Estimated total monthly expenses</dt>
          <dd>{formatCentsCurrency(totals.totalExpensesCents)}</dd>
        </div>
        <div>
          <dt>Estimated monthly surplus / deficit</dt>
          <dd>
            {totals.surplusOrDeficitCents == null
              ? '—'
              : formatCentsCurrency(totals.surplusOrDeficitCents)}
          </dd>
        </div>
      </dl>
      <p className="crm-field-hint">
        Totals are estimates. Blank expense fields are treated as $0 only for display totals and
        remain blank in saved answers.
      </p>

      <label className="crm-field">
        Notes
        <textarea
          disabled={readOnly}
          rows={3}
          value={cashFlow.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </label>
    </section>
  )
}
