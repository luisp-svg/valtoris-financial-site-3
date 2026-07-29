import EmptyState from '../../../components/ui/EmptyState'
import type { CrmHouseholdDetail } from '../../types'
import { createClientId } from '../onboardingMoney'
import {
  emptyIncomeSource,
  type HouseholdOnboardingAnswers,
  type OnboardingIncomeAnswers,
  type OnboardingIncomeSource,
} from '../onboardingFormTypes'
import type { OnboardingSectionConfig } from '../onboardingSections'
import { memberDisplayLabel, validateIncomeSection } from '../onboardingValidation'
import MoneyField from './MoneyField'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeIncome: (
    income: OnboardingIncomeAnswers | ((prev: OnboardingIncomeAnswers) => OnboardingIncomeAnswers),
  ) => void
}

export default function IncomeEmploymentSection({
  section,
  household,
  answers,
  readOnly,
  onChangeIncome,
}: Props) {
  const income = answers.income
  const validation = validateIncomeSection(answers)

  function updateSource(id: string, partial: Partial<OnboardingIncomeSource>) {
    onChangeIncome((prev) => ({
      ...prev,
      sources: prev.sources.map((source) =>
        source.id === id ? { ...source, ...partial } : source,
      ),
    }))
  }

  function removeSource(id: string) {
    if (!window.confirm('Remove this income source?')) return
    onChangeIncome((prev) => ({
      ...prev,
      sources: prev.sources.filter((source) => source.id !== id),
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
          checked={income.noCurrentIncome}
          onChange={(e) =>
            onChangeIncome((prev) => ({
              ...prev,
              noCurrentIncome: e.target.checked,
            }))
          }
        />
        Household currently has no income
      </label>

      {!readOnly ? (
        <button
          type="button"
          className="crm-secondary-btn"
          disabled={income.noCurrentIncome}
          onClick={() =>
            onChangeIncome((prev) => ({
              ...prev,
              noCurrentIncome: false,
              sources: [...prev.sources, emptyIncomeSource({ id: createClientId() })],
            }))
          }
        >
          + Add income source
        </button>
      ) : null}

      {income.sources.length === 0 ? (
        <EmptyState
          title="No income sources"
          description={
            income.noCurrentIncome
              ? 'Marked as no current income.'
              : 'Add a source or mark no current income to complete this section honestly.'
          }
        />
      ) : (
        <div className="crm-onboarding-repeatable-list">
          {income.sources.map((source, index) => (
            <fieldset key={source.id} className="crm-onboarding-repeatable-card" disabled={readOnly}>
              <legend>Income source {index + 1}</legend>
              <div className="crm-onboarding-form-grid">
                <label className="crm-field">
                  Linked member
                  <select
                    value={source.memberId ?? ''}
                    onChange={(e) =>
                      updateSource(source.id, { memberId: e.target.value || null })
                    }
                  >
                    <option value="">Not linked</option>
                    {household.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {memberDisplayLabel(member)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="crm-field">
                  Employer / source name
                  <input
                    value={source.employerOrSourceName}
                    onChange={(e) =>
                      updateSource(source.id, { employerOrSourceName: e.target.value })
                    }
                  />
                </label>
                <label className="crm-field">
                  Occupation
                  <input
                    value={source.occupation}
                    onChange={(e) => updateSource(source.id, { occupation: e.target.value })}
                  />
                </label>
                <label className="crm-field">
                  Employment status
                  <select
                    value={source.employmentStatus}
                    onChange={(e) =>
                      updateSource(source.id, {
                        employmentStatus: e.target
                          .value as OnboardingIncomeSource['employmentStatus'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="employed_full_time">Employed full-time</option>
                    <option value="employed_part_time">Employed part-time</option>
                    <option value="self_employed">Self-employed</option>
                    <option value="contract">Contract</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="retired">Retired</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <MoneyField
                  label="Gross annual income"
                  name={`${source.id}-gross`}
                  value={source.grossAnnualIncomeCents}
                  onChange={(cents) => updateSource(source.id, { grossAnnualIncomeCents: cents })}
                />
                <MoneyField
                  label="Net monthly income"
                  name={`${source.id}-net`}
                  value={source.netMonthlyIncomeCents}
                  onChange={(cents) => updateSource(source.id, { netMonthlyIncomeCents: cents })}
                />
                <label className="crm-field">
                  Pay frequency
                  <select
                    value={source.payFrequency}
                    onChange={(e) =>
                      updateSource(source.id, {
                        payFrequency: e.target.value as OnboardingIncomeSource['payFrequency'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="semimonthly">Semi-monthly</option>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="variable">Variable</option>
                  </select>
                </label>
                <MoneyField
                  label="Variable / commission income"
                  name={`${source.id}-var`}
                  value={source.variableOrCommissionIncomeCents}
                  onChange={(cents) =>
                    updateSource(source.id, { variableOrCommissionIncomeCents: cents })
                  }
                />
                <MoneyField
                  label="Other income"
                  name={`${source.id}-other`}
                  value={source.otherIncomeCents}
                  onChange={(cents) => updateSource(source.id, { otherIncomeCents: cents })}
                />
              </div>
              <label className="crm-field">
                Expected income changes
                <input
                  value={source.expectedIncomeChanges}
                  onChange={(e) =>
                    updateSource(source.id, { expectedIncomeChanges: e.target.value })
                  }
                />
              </label>
              <label className="crm-field">
                Employer benefits notes
                <input
                  value={source.employerBenefitsNotes}
                  onChange={(e) =>
                    updateSource(source.id, { employerBenefitsNotes: e.target.value })
                  }
                />
                <span className="crm-field-hint">Not treated as verified benefits.</span>
              </label>
              {!readOnly ? (
                <button
                  type="button"
                  className="crm-text-btn-danger"
                  onClick={() => removeSource(source.id)}
                >
                  Remove source
                </button>
              ) : null}
            </fieldset>
          ))}
        </div>
      )}

      <label className="crm-field">
        Section notes
        <textarea
          disabled={readOnly}
          rows={3}
          value={income.notes}
          onChange={(e) =>
            onChangeIncome((prev) => ({ ...prev, notes: e.target.value }))
          }
        />
      </label>
    </section>
  )
}
