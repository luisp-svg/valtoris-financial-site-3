import EmptyState from '../../../components/ui/EmptyState'
import type { CrmHouseholdDetail } from '../../types'
import {
  createClientId,
  formatCentsCurrency,
  formatPercentForInput,
  parseNonNegativePercent,
} from '../onboardingMoney'
import {
  emptyDebtItem,
  type HouseholdOnboardingAnswers,
  type OnboardingDebtItem,
  type OnboardingDebtsAnswers,
} from '../onboardingFormTypes'
import type { OnboardingSectionConfig } from '../onboardingSections'
import {
  computeKnownDebtTotals,
  memberDisplayLabel,
  validateDebtsSection,
} from '../onboardingValidation'
import MoneyField from './MoneyField'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeDebts: (
    debts: OnboardingDebtsAnswers | ((prev: OnboardingDebtsAnswers) => OnboardingDebtsAnswers),
  ) => void
}

export default function DebtsLiabilitiesSection({
  section,
  household,
  answers,
  readOnly,
  onChangeDebts,
}: Props) {
  const debts = answers.debts
  const validation = validateDebtsSection(answers)
  const totals = computeKnownDebtTotals(answers)

  function updateItem(id: string, partial: Partial<OnboardingDebtItem>) {
    onChangeDebts((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    }))
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <SectionValidationSummary result={validation} />

      <label className="crm-field crm-onboarding-checkbox">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={debts.noDebts}
          onChange={(e) => onChangeDebts((prev) => ({ ...prev, noDebts: e.target.checked }))}
        />
        Household reports no debts / liabilities
      </label>

      {!readOnly ? (
        <button
          type="button"
          className="crm-secondary-btn"
          disabled={debts.noDebts}
          onClick={() =>
            onChangeDebts((prev) => ({
              ...prev,
              noDebts: false,
              items: [...prev.items, emptyDebtItem({ id: createClientId() })],
            }))
          }
        >
          + Add debt
        </button>
      ) : null}

      {debts.items.length === 0 ? (
        <EmptyState
          title="No debts listed"
          description={
            debts.noDebts
              ? 'Marked as no debts.'
              : 'Add debts or acknowledge that none apply.'
          }
        />
      ) : (
        <div className="crm-onboarding-repeatable-list">
          {debts.items.map((item, index) => (
            <fieldset key={item.id} className="crm-onboarding-repeatable-card" disabled={readOnly}>
              <legend>Debt {index + 1}</legend>
              <div className="crm-onboarding-form-grid">
                <label className="crm-field">
                  Debt type *
                  <select
                    value={item.debtType}
                    onChange={(e) =>
                      updateItem(item.id, {
                        debtType: e.target.value as OnboardingDebtItem['debtType'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="mortgage">Mortgage</option>
                    <option value="home_equity">Home equity</option>
                    <option value="auto_loan">Auto loan</option>
                    <option value="credit_card">Credit card</option>
                    <option value="student_loan">Student loan</option>
                    <option value="personal_loan">Personal loan</option>
                    <option value="business_debt">Business debt</option>
                    <option value="medical_debt">Medical debt</option>
                    <option value="tax_debt">Tax debt</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="crm-field">
                  Creditor / lender
                  <input
                    value={item.creditor}
                    onChange={(e) => updateItem(item.id, { creditor: e.target.value })}
                  />
                </label>
                <MoneyField
                  label="Current balance"
                  name={`${item.id}-balance`}
                  value={item.balanceCents}
                  onChange={(cents) => updateItem(item.id, { balanceCents: cents })}
                />
                <label className="crm-field">
                  Interest rate (%)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatPercentForInput(item.interestRatePercent)}
                    onChange={(e) => {
                      const parsed = parseNonNegativePercent(e.target.value)
                      if (parsed.error && e.target.value.trim() !== '') return
                      updateItem(item.id, { interestRatePercent: parsed.percent })
                    }}
                  />
                  <span className="crm-field-hint">Stored as percentage points (e.g. 4.5 = 4.5%).</span>
                </label>
                <MoneyField
                  label="Minimum monthly payment"
                  name={`${item.id}-min`}
                  value={item.minimumPaymentCents}
                  onChange={(cents) => updateItem(item.id, { minimumPaymentCents: cents })}
                />
                <label className="crm-field">
                  Status
                  <select
                    value={item.status}
                    onChange={(e) =>
                      updateItem(item.id, {
                        status: e.target.value as OnboardingDebtItem['status'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="current">Current</option>
                    <option value="past_due">Past due</option>
                    <option value="in_collections">In collections</option>
                    <option value="deferred">Deferred</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="crm-field">
                  Responsible member
                  <select
                    value={item.responsibleMemberId ?? ''}
                    onChange={(e) =>
                      updateItem(item.id, {
                        responsibleMemberId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Not specified</option>
                    {household.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {memberDisplayLabel(member)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className="crm-text-btn-danger"
                  onClick={() => {
                    if (!window.confirm('Remove this debt?')) return
                    onChangeDebts((prev) => ({
                      ...prev,
                      items: prev.items.filter((row) => row.id !== item.id),
                    }))
                  }}
                >
                  Remove debt
                </button>
              ) : null}
            </fieldset>
          ))}
        </div>
      )}

      <dl className="crm-client-workspace-info-list">
        <div>
          <dt>Total known balances</dt>
          <dd>{formatCentsCurrency(totals.totalBalanceCents)}</dd>
        </div>
        <div>
          <dt>Total known minimum payments</dt>
          <dd>{formatCentsCurrency(totals.totalMinimumPaymentCents)}</dd>
        </div>
      </dl>
      <p className="crm-field-hint">
        Totals exclude unknown balances/payments. No payoff recommendations are calculated here.
      </p>

      <label className="crm-field">
        Notes
        <textarea
          disabled={readOnly}
          rows={3}
          value={debts.notes}
          onChange={(e) => onChangeDebts((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </label>
    </section>
  )
}
