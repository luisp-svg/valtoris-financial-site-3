import type { CrmHouseholdDetail } from '../../types'
import {
  ADVISOR_NOTES_MAX_LENGTH,
  type HouseholdOnboardingAnswers,
  type OnboardingOverviewAnswers,
} from '../onboardingFormTypes'
import type { OnboardingSectionConfig } from '../onboardingSections'
import { validateOverviewSection } from '../onboardingValidation'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeOverview: (
    overview:
      | OnboardingOverviewAnswers
      | ((prev: OnboardingOverviewAnswers) => OnboardingOverviewAnswers),
  ) => void
}

export default function HouseholdOverviewSection({
  section,
  household,
  answers,
  readOnly,
  onChangeOverview,
}: Props) {
  const overview = answers.overview
  const validation = validateOverviewSection(answers, { household })
  const primary = household.members.find((m) => m.is_primary_contact)

  function patch(partial: Partial<OnboardingOverviewAnswers>) {
    onChangeOverview((prev) => ({ ...prev, ...partial }))
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>

      <SectionValidationSummary result={validation} />

      <div className="crm-onboarding-subsection">
        <h3 className="crm-onboarding-subtitle">Household profile (CRM)</h3>
        <p className="crm-field-hint">
          Read-only profile information. Edit household records outside onboarding when needed.
        </p>
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Household name</dt>
            <dd>{household.display_name}</dd>
          </div>
          <div>
            <dt>Primary contact</dt>
            <dd>
              {primary
                ? `${primary.first_name} ${primary.last_name}`
                : 'No primary contact assigned'}
            </dd>
          </div>
          <div>
            <dt>Primary email</dt>
            <dd>{household.primary_email || '—'}</dd>
          </div>
          <div>
            <dt>Primary phone</dt>
            <dd>{household.primary_phone || '—'}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>
              {[household.address_line1, household.address_line2].filter(Boolean).join(', ') ||
                '—'}
            </dd>
          </div>
          <div>
            <dt>City</dt>
            <dd>{household.city || '—'}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{household.state || '—'}</dd>
          </div>
          <div>
            <dt>ZIP code</dt>
            <dd>{household.postal_code || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="crm-onboarding-subsection">
        <h3 className="crm-onboarding-subtitle">Onboarding information</h3>
        <div className="crm-onboarding-form-grid">
          <label className="crm-field">
            Household / marital status *
            <select
              disabled={readOnly}
              value={overview.maritalOrHouseholdStatus}
              onChange={(e) =>
                patch({
                  maritalOrHouseholdStatus: e.target
                    .value as OnboardingOverviewAnswers['maritalOrHouseholdStatus'],
                })
              }
            >
              <option value="">Select…</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="domestic_partnership">Domestic partnership</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="crm-field">
            Number of dependents *
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={overview.dependentsCount ?? ''}
              placeholder="e.g. 0"
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  patch({ dependentsCount: null })
                  return
                }
                const n = Number.parseInt(raw, 10)
                if (!Number.isFinite(n) || n < 0) return
                patch({ dependentsCount: n })
              }}
            />
            <span className="crm-field-hint">Explicit 0 is allowed. Leave blank if unknown.</span>
          </label>

          <label className="crm-field">
            Preferred contact method *
            <select
              disabled={readOnly}
              value={overview.preferredContactMethod}
              onChange={(e) =>
                patch({
                  preferredContactMethod: e.target
                    .value as OnboardingOverviewAnswers['preferredContactMethod'],
                })
              }
            >
              <option value="">Select…</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="text">Text</option>
              <option value="video">Video</option>
              <option value="in_person">In person</option>
            </select>
          </label>
        </div>

        <label className="crm-field">
          Advisor onboarding notes (optional)
          <textarea
            disabled={readOnly}
            rows={4}
            maxLength={ADVISOR_NOTES_MAX_LENGTH}
            value={overview.advisorNotes}
            onChange={(e) => patch({ advisorNotes: e.target.value })}
          />
          {validation.errors.advisorNotes ? (
            <span className="crm-field-error">{validation.errors.advisorNotes}</span>
          ) : (
            <span className="crm-field-hint">
              {overview.advisorNotes.length}/{ADVISOR_NOTES_MAX_LENGTH}
            </span>
          )}
        </label>

        <label className="crm-field">
          Additional household context (optional)
          <textarea
            disabled={readOnly}
            rows={3}
            maxLength={ADVISOR_NOTES_MAX_LENGTH}
            value={overview.additionalContext}
            onChange={(e) => patch({ additionalContext: e.target.value })}
          />
        </label>
      </div>
    </section>
  )
}
