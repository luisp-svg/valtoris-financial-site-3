import EmptyState from '../../../components/ui/EmptyState'
import {
  emptyImmediateConcern,
  emptyPriorityItem,
  type GoalSource,
  type HouseholdOnboardingAnswers,
  type OnboardingGoalsAnswers,
  type OnboardingImmediateConcern,
  type OnboardingPriorityItem,
} from '../onboardingFormTypes'
import { createClientId } from '../onboardingMoney'
import type { OnboardingSectionConfig } from '../onboardingSections'
import { validateGoalsSection } from '../onboardingValidation'
import MoneyField from './MoneyField'
import SectionValidationSummary from './SectionValidationSummary'

type Props = {
  section: OnboardingSectionConfig
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeGoals: (
    goals: OnboardingGoalsAnswers | ((prev: OnboardingGoalsAnswers) => OnboardingGoalsAnswers),
  ) => void
}

const CATEGORY_OPTIONS: { value: OnboardingPriorityItem['category']; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'cash_flow', label: 'Cash flow' },
  { value: 'emergency_fund', label: 'Emergency fund' },
  { value: 'debt', label: 'Debt' },
  { value: 'credit', label: 'Credit' },
  { value: 'protection', label: 'Protection' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'estate_legacy', label: 'Estate and legacy' },
  { value: 'homeownership', label: 'Homeownership' },
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'tax_planning', label: 'Tax planning' },
  { value: 'major_purchase', label: 'Major purchase' },
  { value: 'other', label: 'Other' },
]

const SOURCE_OPTIONS: { value: GoalSource; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'client_stated', label: 'Client-stated' },
  { value: 'advisor_observed', label: 'Advisor-observed' },
]

export default function GoalsPrioritiesSection({
  section,
  answers,
  readOnly,
  onChangeGoals,
}: Props) {
  const goals = answers.goals
  const validation = validateGoalsSection(answers)

  function patch(partial: Partial<OnboardingGoalsAnswers>) {
    onChangeGoals((prev) => ({ ...prev, ...partial }))
  }

  function updateConcern(id: string, partial: Partial<OnboardingImmediateConcern>) {
    onChangeGoals((prev) => ({
      ...prev,
      immediateConcerns: prev.immediateConcerns.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }))
  }

  function updatePriority(id: string, partial: Partial<OnboardingPriorityItem>) {
    onChangeGoals((prev) => ({
      ...prev,
      priorities: prev.priorities.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }))
  }

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <p className="crm-field-hint">
        Keep client-stated goals distinct from advisor-observed priorities. This section captures
        goals only — action plans are created later.
      </p>
      <SectionValidationSummary result={validation} />

      <label className="crm-field crm-onboarding-checkbox">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={goals.noCurrentGoals}
          onChange={(e) => patch({ noCurrentGoals: e.target.checked })}
        />
        No current goals to document (use only when genuinely appropriate)
      </label>

      <div className="crm-onboarding-subsection">
        <h3 className="crm-onboarding-subtitle">Immediate concerns</h3>
        {!readOnly ? (
          <button
            type="button"
            className="crm-secondary-btn"
            disabled={goals.noCurrentGoals}
            onClick={() =>
              onChangeGoals((prev) => ({
                ...prev,
                noCurrentGoals: false,
                immediateConcerns: [
                  ...prev.immediateConcerns,
                  emptyImmediateConcern({ id: createClientId(), source: 'client_stated' }),
                ],
              }))
            }
          >
            + Add concern
          </button>
        ) : null}
        {goals.immediateConcerns.length === 0 ? (
          <EmptyState title="No immediate concerns listed" description="Optional structured concerns." />
        ) : (
          <div className="crm-onboarding-repeatable-list">
            {goals.immediateConcerns.map((item, index) => (
              <fieldset key={item.id} className="crm-onboarding-repeatable-card" disabled={readOnly}>
                <legend>Concern {index + 1}</legend>
                <div className="crm-onboarding-form-grid">
                  <label className="crm-field">
                    Description *
                    <input
                      value={item.description}
                      onChange={(e) => updateConcern(item.id, { description: e.target.value })}
                    />
                  </label>
                  <label className="crm-field">
                    Source *
                    <select
                      value={item.source}
                      onChange={(e) =>
                        updateConcern(item.id, { source: e.target.value as GoalSource })
                      }
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    Urgency
                    <select
                      value={item.urgency}
                      onChange={(e) =>
                        updateConcern(item.id, {
                          urgency: e.target.value as OnboardingImmediateConcern['urgency'],
                        })
                      }
                    >
                      <option value="">Select…</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="crm-field">
                    Category
                    <select
                      value={item.category}
                      onChange={(e) =>
                        updateConcern(item.id, {
                          category: e.target.value as OnboardingImmediateConcern['category'],
                        })
                      }
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
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
                      if (!window.confirm('Remove this concern?')) return
                      onChangeGoals((prev) => ({
                        ...prev,
                        immediateConcerns: prev.immediateConcerns.filter((row) => row.id !== item.id),
                      }))
                    }}
                  >
                    Remove concern
                  </button>
                ) : null}
              </fieldset>
            ))}
          </div>
        )}
      </div>

      <div className="crm-onboarding-subsection">
        <h3 className="crm-onboarding-subtitle">Top priorities</h3>
        {!readOnly ? (
          <button
            type="button"
            className="crm-secondary-btn"
            disabled={goals.noCurrentGoals}
            onClick={() =>
              onChangeGoals((prev) => ({
                ...prev,
                noCurrentGoals: false,
                priorities: [
                  ...prev.priorities,
                  emptyPriorityItem({
                    id: createClientId(),
                    rank: prev.priorities.length + 1,
                    source: 'client_stated',
                  }),
                ],
              }))
            }
          >
            + Add priority
          </button>
        ) : null}
        {validation.errors.priorityRanks ? (
          <p className="crm-field-error">{validation.errors.priorityRanks}</p>
        ) : null}
        {goals.priorities.length === 0 ? (
          <EmptyState
            title="No ranked priorities"
            description="Add at least one ranked priority unless no-current-goals applies."
          />
        ) : (
          <div className="crm-onboarding-repeatable-list">
            {goals.priorities.map((item) => (
              <fieldset key={item.id} className="crm-onboarding-repeatable-card" disabled={readOnly}>
                <legend>Priority rank {item.rank ?? '—'}</legend>
                <div className="crm-onboarding-form-grid">
                  <label className="crm-field">
                    Rank *
                    <input
                      type="number"
                      min={1}
                      value={item.rank ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') {
                          updatePriority(item.id, { rank: null })
                          return
                        }
                        const n = Number.parseInt(raw, 10)
                        if (!Number.isFinite(n) || n < 0) return
                        updatePriority(item.id, { rank: n })
                      }}
                    />
                  </label>
                  <label className="crm-field">
                    Title *
                    <input
                      value={item.title}
                      onChange={(e) => updatePriority(item.id, { title: e.target.value })}
                    />
                  </label>
                  <label className="crm-field">
                    Source *
                    <select
                      value={item.source}
                      onChange={(e) =>
                        updatePriority(item.id, { source: e.target.value as GoalSource })
                      }
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    Time horizon
                    <select
                      value={item.timeHorizon}
                      onChange={(e) =>
                        updatePriority(item.id, {
                          timeHorizon: e.target.value as OnboardingPriorityItem['timeHorizon'],
                        })
                      }
                    >
                      <option value="">Select…</option>
                      <option value="immediate">Immediate</option>
                      <option value="30_days">30 days</option>
                      <option value="90_days">90 days</option>
                      <option value="12_months">12 months</option>
                      <option value="1_3_years">1–3 years</option>
                      <option value="long_term">Long term</option>
                    </select>
                  </label>
                  <label className="crm-field">
                    Category
                    <select
                      value={item.category}
                      onChange={(e) =>
                        updatePriority(item.id, {
                          category: e.target.value as OnboardingPriorityItem['category'],
                        })
                      }
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <MoneyField
                    label="Target amount"
                    name={`${item.id}-target`}
                    value={item.targetAmountCents}
                    onChange={(cents) => updatePriority(item.id, { targetAmountCents: cents })}
                    error={validation.errors[`priority_${item.id}_target`]}
                  />
                  <label className="crm-field">
                    Target date
                    <input
                      type="date"
                      value={item.targetDate ?? ''}
                      onChange={(e) =>
                        updatePriority(item.id, { targetDate: e.target.value || null })
                      }
                    />
                    {validation.errors[`priority_${item.id}_date`] ? (
                      <span className="crm-field-error">
                        {validation.errors[`priority_${item.id}_date`]}
                      </span>
                    ) : null}
                  </label>
                  <label className="crm-field">
                    Status
                    <select
                      value={item.status}
                      onChange={(e) =>
                        updatePriority(item.id, {
                          status: e.target.value as OnboardingPriorityItem['status'],
                        })
                      }
                    >
                      <option value="">Select…</option>
                      <option value="identified">Identified</option>
                      <option value="in_progress">In progress</option>
                      <option value="deferred">Deferred</option>
                      <option value="completed">Completed</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                </div>
                <label className="crm-field">
                  Description
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => updatePriority(item.id, { description: e.target.value })}
                  />
                </label>
                {!readOnly ? (
                  <button
                    type="button"
                    className="crm-text-btn-danger"
                    onClick={() => {
                      if (!window.confirm('Remove this priority?')) return
                      onChangeGoals((prev) => ({
                        ...prev,
                        priorities: prev.priorities.filter((row) => row.id !== item.id),
                      }))
                    }}
                  >
                    Remove priority
                  </button>
                ) : null}
              </fieldset>
            ))}
          </div>
        )}
      </div>

      <label className="crm-field">
        Major upcoming financial events
        <textarea
          disabled={readOnly}
          rows={2}
          value={goals.majorUpcomingEvents}
          onChange={(e) => patch({ majorUpcomingEvents: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Long-term vision
        <textarea
          disabled={readOnly}
          rows={2}
          value={goals.longTermVision}
          onChange={(e) => patch({ longTermVision: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Primary motivation
        <textarea
          disabled={readOnly}
          rows={2}
          value={goals.primaryMotivation}
          onChange={(e) => patch({ primaryMotivation: e.target.value })}
        />
      </label>
      <label className="crm-field">
        Biggest obstacle
        <textarea
          disabled={readOnly}
          rows={2}
          value={goals.biggestObstacle}
          onChange={(e) => patch({ biggestObstacle: e.target.value })}
        />
      </label>
      <div className="crm-onboarding-form-grid">
        <label className="crm-field">
          Preferred pace
          <select
            disabled={readOnly}
            value={goals.preferredPace}
            onChange={(e) =>
              patch({
                preferredPace: e.target.value as OnboardingGoalsAnswers['preferredPace'],
              })
            }
          >
            <option value="">Select…</option>
            <option value="urgent">Urgent</option>
            <option value="steady">Steady</option>
            <option value="gradual">Gradual</option>
            <option value="exploratory">Exploratory</option>
          </select>
        </label>
        <label className="crm-field">
          Client agrees with documented priorities?
          <select
            disabled={readOnly}
            value={goals.clientAgreesWithPriorities}
            onChange={(e) =>
              patch({
                clientAgreesWithPriorities: e.target
                  .value as OnboardingGoalsAnswers['clientAgreesWithPriorities'],
              })
            }
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>
      <label className="crm-field">
        Advisor summary
        <textarea
          disabled={readOnly}
          rows={3}
          value={goals.advisorSummary}
          onChange={(e) => patch({ advisorSummary: e.target.value })}
        />
      </label>
    </section>
  )
}
