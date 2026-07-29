import EmptyState from '../../../components/ui/EmptyState'
import type { CrmHouseholdDetail } from '../../types'
import {
  INSURANCE_EDUCATIONAL_DISCLOSURE,
  emptyInsuranceCoverage,
  type HouseholdOnboardingAnswers,
  type OnboardingInsuranceAnswers,
  type OnboardingInsuranceCoverage,
} from '../onboardingFormTypes'
import { createClientId } from '../onboardingMoney'
import type { OnboardingSectionConfig } from '../onboardingSections'
import { memberDisplayLabel, validateInsuranceSection } from '../onboardingValidation'
import MoneyField from './MoneyField'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeInsurance: (
    insurance:
      | OnboardingInsuranceAnswers
      | ((prev: OnboardingInsuranceAnswers) => OnboardingInsuranceAnswers),
  ) => void
}

export default function InsuranceProtectionSection({
  section,
  household,
  answers,
  readOnly,
  onChangeInsurance,
}: Props) {
  const insurance = answers.insurance
  const validation = validateInsuranceSection(answers, { household })

  function updateCoverage(id: string, partial: Partial<OnboardingInsuranceCoverage>) {
    onChangeInsurance((prev) => ({
      ...prev,
      coverages: prev.coverages.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...partial }
        if (next.employerProvided) next.personallyOwned = false
        return next
      }),
    }))
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <p className="crm-field-hint">{INSURANCE_EDUCATIONAL_DISCLOSURE}</p>
      <SectionValidationSummary result={validation} />

      <label className="crm-field crm-onboarding-checkbox">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={insurance.noCurrentCoverage}
          onChange={(e) =>
            onChangeInsurance((prev) => ({ ...prev, noCurrentCoverage: e.target.checked }))
          }
        />
        Household reports no current coverage
      </label>

      {!readOnly ? (
        <button
          type="button"
          className="crm-secondary-btn"
          disabled={insurance.noCurrentCoverage}
          onClick={() =>
            onChangeInsurance((prev) => ({
              ...prev,
              noCurrentCoverage: false,
              coverages: [...prev.coverages, emptyInsuranceCoverage({ id: createClientId() })],
            }))
          }
        >
          + Add coverage
        </button>
      ) : null}

      {insurance.coverages.length === 0 ? (
        <EmptyState
          title="No coverage listed"
          description={
            insurance.noCurrentCoverage
              ? 'Marked as no current coverage.'
              : 'Add coverage or acknowledge that none currently applies.'
          }
        />
      ) : (
        <div className="crm-onboarding-repeatable-list">
          {insurance.coverages.map((item, index) => (
            <fieldset key={item.id} className="crm-onboarding-repeatable-card" disabled={readOnly}>
              <legend>Coverage {index + 1}</legend>
              <p className="crm-field-hint">Amounts are client-provided estimates unless confirmed against policy documents.</p>
              <div className="crm-onboarding-form-grid">
                <label className="crm-field">
                  Coverage type *
                  <select
                    value={item.coverageType}
                    onChange={(e) =>
                      updateCoverage(item.id, {
                        coverageType: e.target.value as OnboardingInsuranceCoverage['coverageType'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="life">Life insurance</option>
                    <option value="disability">Disability insurance</option>
                    <option value="health">Health insurance</option>
                    <option value="long_term_care">Long-term care</option>
                    <option value="homeowners_renters">Homeowners / renters</option>
                    <option value="auto">Auto insurance</option>
                    <option value="umbrella">Umbrella</option>
                    <option value="employer_benefits">Employer-provided benefits</option>
                    <option value="business_protection">Business-related protection</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="crm-field">
                  Carrier / provider
                  <input
                    value={item.carrierOrProvider}
                    onChange={(e) => updateCoverage(item.id, { carrierOrProvider: e.target.value })}
                  />
                </label>
                <label className="crm-field">
                  Insured member
                  <select
                    value={item.insuredMemberId ?? ''}
                    onChange={(e) =>
                      updateCoverage(item.id, { insuredMemberId: e.target.value || null })
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
                <label className="crm-field">
                  Policy / plan type
                  <input
                    value={item.policyOrPlanType}
                    onChange={(e) => updateCoverage(item.id, { policyOrPlanType: e.target.value })}
                  />
                </label>
                <MoneyField
                  label="Coverage amount (estimated)"
                  name={`${item.id}-amount`}
                  value={item.coverageAmountCents}
                  onChange={(cents) => updateCoverage(item.id, { coverageAmountCents: cents })}
                />
                <MoneyField
                  label="Premium (estimated)"
                  name={`${item.id}-premium`}
                  value={item.premiumCents}
                  onChange={(cents) => updateCoverage(item.id, { premiumCents: cents })}
                />
                <label className="crm-field">
                  Premium frequency
                  <select
                    value={item.premiumFrequency}
                    onChange={(e) =>
                      updateCoverage(item.id, {
                        premiumFrequency: e.target
                          .value as OnboardingInsuranceCoverage['premiumFrequency'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="crm-field">
                  Beneficiary review
                  <select
                    value={item.beneficiaryReviewStatus}
                    onChange={(e) =>
                      updateCoverage(item.id, {
                        beneficiaryReviewStatus: e.target
                          .value as OnboardingInsuranceCoverage['beneficiaryReviewStatus'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="not_reviewed">Not reviewed</option>
                    <option value="unknown">Unknown</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </label>
                <label className="crm-field">
                  Client-reported status
                  <select
                    value={item.clientReportedStatus}
                    onChange={(e) =>
                      updateCoverage(item.id, {
                        clientReportedStatus: e.target
                          .value as OnboardingInsuranceCoverage['clientReportedStatus'],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="active">Active</option>
                    <option value="lapsed">Lapsed</option>
                    <option value="pending">Pending</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="crm-field">
                  Expiration / term
                  <input
                    value={item.expirationOrTerm}
                    onChange={(e) => updateCoverage(item.id, { expirationOrTerm: e.target.value })}
                  />
                </label>
              </div>
              <label className="crm-field crm-onboarding-checkbox">
                <input
                  type="checkbox"
                  checked={item.employerProvided}
                  onChange={(e) =>
                    updateCoverage(item.id, {
                      employerProvided: e.target.checked,
                      personallyOwned: e.target.checked ? false : item.personallyOwned,
                    })
                  }
                />
                Employer-provided
              </label>
              <label className="crm-field crm-onboarding-checkbox">
                <input
                  type="checkbox"
                  checked={item.personallyOwned}
                  disabled={item.employerProvided}
                  onChange={(e) => updateCoverage(item.id, { personallyOwned: e.target.checked })}
                />
                Personally owned
              </label>
              {!readOnly ? (
                <button
                  type="button"
                  className="crm-text-btn-danger"
                  onClick={() => {
                    if (!window.confirm('Remove this coverage entry?')) return
                    onChangeInsurance((prev) => ({
                      ...prev,
                      coverages: prev.coverages.filter((row) => row.id !== item.id),
                    }))
                  }}
                >
                  Remove coverage
                </button>
              ) : null}
            </fieldset>
          ))}
        </div>
      )}

      <div className="crm-onboarding-form-grid">
        <label className="crm-field">
          Coverage reviewed recently?
          <select
            disabled={readOnly}
            value={insurance.coverageReviewedRecently}
            onChange={(e) =>
              onChangeInsurance((prev) => ({
                ...prev,
                coverageReviewedRecently: e.target
                  .value as OnboardingInsuranceAnswers['coverageReviewedRecently'],
              }))
            }
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="crm-field">
          Beneficiaries reviewed?
          <select
            disabled={readOnly}
            value={insurance.beneficiariesReviewed}
            onChange={(e) =>
              onChangeInsurance((prev) => ({
                ...prev,
                beneficiariesReviewed: e.target
                  .value as OnboardingInsuranceAnswers['beneficiariesReviewed'],
              }))
            }
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="crm-field">
          Dependents rely on household income?
          <select
            disabled={readOnly}
            value={insurance.dependentsRelyOnIncome}
            onChange={(e) =>
              onChangeInsurance((prev) => ({
                ...prev,
                dependentsRelyOnIncome: e.target
                  .value as OnboardingInsuranceAnswers['dependentsRelyOnIncome'],
              }))
            }
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>

      <label className="crm-field crm-onboarding-checkbox">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={insurance.protectionConcernsAcknowledged}
          onChange={(e) =>
            onChangeInsurance((prev) => ({
              ...prev,
              protectionConcernsAcknowledged: e.target.checked,
            }))
          }
        />
        Protection concerns reviewed or explicitly acknowledged *
      </label>

      <label className="crm-field">
        Client-stated concerns
        <textarea
          disabled={readOnly}
          rows={2}
          value={insurance.clientStatedConcerns}
          onChange={(e) =>
            onChangeInsurance((prev) => ({ ...prev, clientStatedConcerns: e.target.value }))
          }
        />
      </label>
      <label className="crm-field">
        Advisor-observed concerns
        <textarea
          disabled={readOnly}
          rows={2}
          value={insurance.advisorObservedConcerns}
          onChange={(e) =>
            onChangeInsurance((prev) => ({ ...prev, advisorObservedConcerns: e.target.value }))
          }
        />
      </label>
      <label className="crm-field">
        Known coverage gaps (educational notes only)
        <textarea
          disabled={readOnly}
          rows={2}
          value={insurance.knownCoverageGaps}
          onChange={(e) =>
            onChangeInsurance((prev) => ({ ...prev, knownCoverageGaps: e.target.value }))
          }
        />
        <span className="crm-field-hint">
          Gap notes are for planning review only and are not insurance recommendations.
        </span>
      </label>
    </section>
  )
}
