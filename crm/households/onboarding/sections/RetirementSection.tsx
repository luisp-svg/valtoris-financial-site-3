import type { CrmHouseholdDetail } from '../../types'
import {
  RETIREMENT_EDUCATIONAL_DISCLOSURE,
  type HouseholdOnboardingAnswers,
  type OnboardingRetirementAnswers,
} from '../onboardingFormTypes'
import {
  countKnownRetirementAssetBalances,
  getPrimaryMemberAge,
} from '../onboardingCrossSection'
import { formatCentsCurrency } from '../onboardingMoney'
import type { OnboardingSectionConfig } from '../onboardingSections'
import { validateRetirementSection } from '../onboardingValidation'
import MoneyField from './MoneyField'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeRetirement: (
    retirement:
      | OnboardingRetirementAnswers
      | ((prev: OnboardingRetirementAnswers) => OnboardingRetirementAnswers),
  ) => void
}

export default function RetirementSection({
  section,
  household,
  answers,
  readOnly,
  onChangeRetirement,
}: Props) {
  const retirement = answers.retirement
  const validation = validateRetirementSection(answers, { household })
  const currentAge = getPrimaryMemberAge(household)
  const retirementAssets = countKnownRetirementAssetBalances(answers)

  function patch(partial: Partial<OnboardingRetirementAnswers>) {
    onChangeRetirement((prev) => ({ ...prev, ...partial }))
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <p className="crm-field-hint">{RETIREMENT_EDUCATIONAL_DISCLOSURE}</p>
      <SectionValidationSummary result={validation} />

      <dl className="crm-client-workspace-info-list">
        <div>
          <dt>Primary member age (from CRM)</dt>
          <dd>{currentAge == null ? '—' : String(currentAge)}</dd>
        </div>
        <div>
          <dt>Retirement accounts in Assets</dt>
          <dd>
            {retirementAssets.count === 0
              ? 'None listed in Assets and Savings'
              : `${retirementAssets.count} listed; known balances total ${formatCentsCurrency(retirementAssets.knownBalanceCents)} (referenced, not duplicated)`}
          </dd>
        </div>
      </dl>

      <div className="crm-onboarding-form-grid">
        <label className="crm-field">
          Retirement planning status *
          <select
            disabled={readOnly}
            value={retirement.planningStatus}
            onChange={(e) =>
              patch({
                planningStatus: e.target.value as OnboardingRetirementAnswers['planningStatus'],
              })
            }
          >
            <option value="">Select…</option>
            <option value="not_yet_planning">Not yet planning for retirement</option>
            <option value="early_planning">Early planning</option>
            <option value="actively_saving">Actively saving</option>
            <option value="nearing_retirement">Nearing retirement</option>
            <option value="already_retired">Already retired</option>
            <option value="uncertain">Uncertain</option>
          </select>
        </label>
        <label className="crm-field">
          Desired retirement age
          <input
            type="number"
            min={18}
            max={100}
            disabled={readOnly}
            value={retirement.desiredRetirementAge ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                patch({ desiredRetirementAge: null })
                return
              }
              const n = Number.parseInt(raw, 10)
              if (!Number.isFinite(n) || n < 0) return
              patch({ desiredRetirementAge: n })
            }}
          />
          {validation.errors.desiredRetirementAge ? (
            <span className="crm-field-error">{validation.errors.desiredRetirementAge}</span>
          ) : (
            <span className="crm-field-hint">Optional when already retired, uncertain, or not yet planning.</span>
          )}
        </label>
        <MoneyField
          label="Desired monthly retirement income"
          name="desiredMonthlyIncome"
          disabled={readOnly || retirement.desiredIncomeUnknown}
          value={retirement.desiredMonthlyIncomeCents}
          onChange={(cents) => patch({ desiredMonthlyIncomeCents: cents })}
          error={validation.errors.desiredMonthlyIncomeCents}
        />
        <label className="crm-field crm-onboarding-checkbox">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={retirement.desiredIncomeUnknown}
            onChange={(e) =>
              patch({
                desiredIncomeUnknown: e.target.checked,
                desiredMonthlyIncomeCents: e.target.checked
                  ? null
                  : retirement.desiredMonthlyIncomeCents,
              })
            }
          />
          Desired income unknown / not discussed
        </label>
        <MoneyField
          label="Current monthly retirement contributions"
          name="currentContribution"
          disabled={readOnly}
          value={retirement.currentMonthlyContributionCents}
          onChange={(cents) => patch({ currentMonthlyContributionCents: cents })}
          hint="Blank = unknown. Explicit 0 is allowed."
          error={validation.errors.currentMonthlyContributionCents}
        />
        <label className="crm-field crm-onboarding-checkbox">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={retirement.contributionAcknowledged}
            onChange={(e) => patch({ contributionAcknowledged: e.target.checked })}
          />
          Contribution behavior acknowledged
        </label>
        <label className="crm-field">
          Employer match
          <select
            disabled={readOnly}
            value={retirement.employerMatchKind}
            onChange={(e) =>
              patch({
                employerMatchKind: e.target
                  .value as OnboardingRetirementAnswers['employerMatchKind'],
              })
            }
          >
            <option value="">Select…</option>
            <option value="percent">Percentage</option>
            <option value="amount">Dollar amount</option>
            <option value="none">None</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="crm-field">
          Employer match percent
          <input
            type="text"
            inputMode="decimal"
            disabled={readOnly || retirement.employerMatchKind !== 'percent'}
            value={retirement.employerMatchPercent ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (raw === '') {
                patch({ employerMatchPercent: null })
                return
              }
              const n = Number.parseFloat(raw)
              if (!Number.isFinite(n) || n < 0) return
              patch({ employerMatchPercent: n })
            }}
          />
        </label>
        <MoneyField
          label="Employer match amount"
          name="employerMatchAmount"
          disabled={readOnly || retirement.employerMatchKind !== 'amount'}
          value={retirement.employerMatchAmountCents}
          onChange={(cents) => patch({ employerMatchAmountCents: cents })}
        />
        <label className="crm-field">
          Pension available?
          <select
            disabled={readOnly}
            value={retirement.pensionAvailable}
            onChange={(e) =>
              patch({
                pensionAvailable: e.target
                  .value as OnboardingRetirementAnswers['pensionAvailable'],
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
          Social Security expectation
          <select
            disabled={readOnly}
            value={retirement.socialSecurityExpectation}
            onChange={(e) =>
              patch({
                socialSecurityExpectation: e.target
                  .value as OnboardingRetirementAnswers['socialSecurityExpectation'],
              })
            }
          >
            <option value="">Select…</option>
            <option value="expected">Expected</option>
            <option value="not_expected">Not expected</option>
            <option value="uncertain">Uncertain</option>
            <option value="not_discussed">Not discussed</option>
          </select>
        </label>
        <label className="crm-field">
          Retirement confidence
          <select
            disabled={readOnly}
            value={retirement.retirementConfidence}
            onChange={(e) =>
              patch({
                retirementConfidence: e.target
                  .value as OnboardingRetirementAnswers['retirementConfidence'],
              })
            }
          >
            <option value="">Select…</option>
            <option value="very_confident">Very confident</option>
            <option value="somewhat_confident">Somewhat confident</option>
            <option value="uncertain">Uncertain</option>
            <option value="not_confident">Not confident</option>
            <option value="not_discussed">Not discussed</option>
          </select>
        </label>
      </div>

      <label className="crm-field">
        Pension details / notes
        <input
          disabled={readOnly}
          value={retirement.pensionNotes}
          onChange={(e) => patch({ pensionNotes: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Primary retirement concerns
        <textarea
          disabled={readOnly}
          rows={2}
          value={retirement.primaryConcerns}
          onChange={(e) => patch({ primaryConcerns: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Expected retirement lifestyle
        <input
          disabled={readOnly}
          value={retirement.expectedLifestyle}
          onChange={(e) => patch({ expectedLifestyle: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Major retirement goals
        <textarea
          disabled={readOnly}
          rows={2}
          value={retirement.majorGoals}
          onChange={(e) => patch({ majorGoals: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Planned retirement location
        <input
          disabled={readOnly}
          value={retirement.plannedLocation}
          onChange={(e) => patch({ plannedLocation: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Other anticipated retirement income
        <input
          disabled={readOnly}
          value={retirement.otherAnticipatedIncome}
          onChange={(e) => patch({ otherAnticipatedIncome: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Advisor notes
        <textarea
          disabled={readOnly}
          rows={3}
          value={retirement.advisorNotes}
          onChange={(e) => patch({ advisorNotes: e.target.value })}
        />
      </label>
    </section>
  )
}
