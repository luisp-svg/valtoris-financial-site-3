import type { CrmHouseholdDetail } from '../../types'
import {
  ESTATE_LEGAL_DISCLOSURE,
  ESTATE_PLANNING_ITEM_LABELS,
  type EstateItemStatus,
  type HouseholdOnboardingAnswers,
  type OnboardingEstateAnswers,
} from '../onboardingFormTypes'
import type { OnboardingSectionConfig } from '../onboardingSections'
import { validateEstateSection } from '../onboardingValidation'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeEstate: (
    estate:
      | OnboardingEstateAnswers
      | ((prev: OnboardingEstateAnswers) => OnboardingEstateAnswers),
  ) => void
}

const STATUS_OPTIONS: { value: EstateItemStatus; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'in_place', label: 'In place' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'not_in_place', label: 'Not in place' },
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'unknown', label: 'Unknown' },
]

export default function EstateLegacySection({
  section,
  household,
  answers,
  readOnly,
  onChangeEstate,
}: Props) {
  const estate = answers.estate
  const validation = validateEstateSection(answers, { household })

  function patch(partial: Partial<OnboardingEstateAnswers>) {
    onChangeEstate((prev) => ({ ...prev, ...partial }))
  }

  function updateItemStatus(key: string, status: EstateItemStatus) {
    onChangeEstate((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.key === key ? { ...item, status } : item)),
    }))
  }

  function updateItemNotes(key: string, notes: string) {
    onChangeEstate((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.key === key ? { ...item, notes } : item)),
    }))
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <p className="crm-field-hint">{ESTATE_LEGAL_DISCLOSURE}</p>
      <SectionValidationSummary result={validation} />

      <label className="crm-field crm-onboarding-checkbox">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={estate.itemsAcknowledged}
          onChange={(e) => patch({ itemsAcknowledged: e.target.checked })}
        />
        Estate-planning checklist reviewed or explicitly acknowledged *
      </label>

      <div className="crm-onboarding-estate-list">
        {estate.items.map((item) => (
          <div key={item.key} className="crm-onboarding-estate-row">
            <label className="crm-field">
              {ESTATE_PLANNING_ITEM_LABELS[item.key]}
              <select
                disabled={readOnly}
                value={item.status}
                onChange={(e) =>
                  updateItemStatus(item.key, e.target.value as EstateItemStatus)
                }
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-field">
              Notes (optional)
              <input
                disabled={readOnly}
                value={item.notes}
                onChange={(e) => updateItemNotes(item.key, e.target.value)}
                placeholder="No document contents — status notes only"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="crm-onboarding-form-grid">
        <label className="crm-field">
          Minor dependents need guardianship planning?
          <select
            disabled={readOnly}
            value={estate.minorDependentsNeedGuardianship}
            onChange={(e) =>
              patch({
                minorDependentsNeedGuardianship: e.target
                  .value as OnboardingEstateAnswers['minorDependentsNeedGuardianship'],
              })
            }
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="crm-field">
          Last known review date
          <input
            type="date"
            disabled={readOnly}
            value={estate.lastReviewDate ?? ''}
            onChange={(e) => patch({ lastReviewDate: e.target.value || null })}
          />
          {validation.errors.lastReviewDate ? (
            <span className="crm-field-error">{validation.errors.lastReviewDate}</span>
          ) : null}
        </label>
        <label className="crm-field">
          Estate attorney relationship
          <input
            disabled={readOnly}
            value={estate.estateAttorneyRelationship}
            onChange={(e) => patch({ estateAttorneyRelationship: e.target.value })}
          />
        </label>
      </div>

      <label className="crm-field">
        Legacy goals
        <textarea
          disabled={readOnly}
          rows={2}
          value={estate.legacyGoals}
          onChange={(e) => patch({ legacyGoals: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Charitable goals
        <textarea
          disabled={readOnly}
          rows={2}
          value={estate.charitableGoals}
          onChange={(e) => patch({ charitableGoals: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Family transfer goals
        <textarea
          disabled={readOnly}
          rows={2}
          value={estate.familyTransferGoals}
          onChange={(e) => patch({ familyTransferGoals: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Client-stated estate concerns
        <textarea
          disabled={readOnly}
          rows={2}
          value={estate.clientStatedConcerns}
          onChange={(e) => patch({ clientStatedConcerns: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Advisor-observed concerns
        <textarea
          disabled={readOnly}
          rows={2}
          value={estate.advisorObservedConcerns}
          onChange={(e) => patch({ advisorObservedConcerns: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Business continuity concerns
        <textarea
          disabled={readOnly}
          rows={2}
          value={estate.businessContinuityConcerns}
          onChange={(e) => patch({ businessContinuityConcerns: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Final expense concerns
        <textarea
          disabled={readOnly}
          rows={2}
          value={estate.finalExpenseConcerns}
          onChange={(e) => patch({ finalExpenseConcerns: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Advisor notes
        <textarea
          disabled={readOnly}
          rows={3}
          value={estate.advisorNotes}
          onChange={(e) => patch({ advisorNotes: e.target.value })}
        />
      </label>
    </section>
  )
}
