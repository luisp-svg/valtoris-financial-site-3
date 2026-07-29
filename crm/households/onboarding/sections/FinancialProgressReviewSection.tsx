import type { CrmHouseholdDetail, HouseholdOnboardingAssessment } from '../../types'
import type { OnboardingSessionMode } from '../loadHouseholdOnboarding'
import {
  formatOnboardingReadiness,
  type OnboardingCompletionValidation,
} from '../onboardingCompletion'
import type { HouseholdOnboardingAnswers } from '../onboardingFormTypes'
import {
  getOnboardingSection,
  type OnboardingSectionConfig,
  type OnboardingSectionId,
} from '../onboardingSections'
import {
  buildReviewSectionSummaries,
  type ReviewSectionSummary,
} from '../onboardingReviewSummaries'

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  assessment: HouseholdOnboardingAssessment
  answers: HouseholdOnboardingAnswers
  mode: OnboardingSessionMode
  readOnly: boolean
  completion: OnboardingCompletionValidation
  completing: boolean
  onEditSection: (sectionId: OnboardingSectionId) => void
  onComplete: () => Promise<unknown>
}

function statusClass(status: ReviewSectionSummary['status']): string {
  switch (status) {
    case 'complete':
      return 'is-complete'
    case 'needs_attention':
      return 'is-needs-attention'
    case 'in_progress':
      return 'is-in-progress'
    default:
      return 'is-not-started'
  }
}

export default function FinancialProgressReviewSection({
  section,
  household,
  assessment,
  answers,
  mode,
  readOnly,
  completion,
  completing,
  onEditSection,
  onComplete,
}: Props) {
  const summaries = buildReviewSectionSummaries({ answers, household, completion })
  const readinessLabel =
    mode === 'completed' ? 'Completed' : formatOnboardingReadiness(completion.readiness)
  const lastSavedLabel = answers.meta.lastSavedAt
    ? new Date(answers.meta.lastSavedAt).toLocaleString()
    : 'Not saved yet'
  const startedLabel = new Date(answers.meta.startedAt).toLocaleString()
  const completedAtLabel = assessment.completed_at
    ? new Date(assessment.completed_at).toLocaleString()
    : null

  return (
    <section
      className="crm-onboarding-review"
      aria-labelledby={`crm-onboarding-section-${section.id}-title`}
    >
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <p className="crm-banner crm-banner-warning" role="status">
        This review summarizes client-provided onboarding intake. It is not a financial score,
        grade, recommendation, or verified analysis.
      </p>

      <div className="crm-onboarding-review-metrics" aria-label="Onboarding readiness">
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Household</dt>
            <dd>{household.display_name}</dd>
          </div>
          <div>
            <dt>Assessment status</dt>
            <dd>{mode === 'completed' ? 'Completed' : 'Draft'}</dd>
          </div>
          <div>
            <dt>Onboarding readiness</dt>
            <dd>{readinessLabel}</dd>
          </div>
          <div>
            <dt>Sections complete</dt>
            <dd>{completion.completeSections.length}</dd>
          </div>
          <div>
            <dt>Sections needing attention</dt>
            <dd>{completion.needsAttentionSections.length}</dd>
          </div>
          <div>
            <dt>Sections incomplete</dt>
            <dd>{completion.incompleteSections.length}</dd>
          </div>
          <div>
            <dt>Last saved</dt>
            <dd>{lastSavedLabel}</dd>
          </div>
          <div>
            <dt>Onboarding started</dt>
            <dd>{startedLabel}</dd>
          </div>
          {completedAtLabel ? (
            <div>
              <dt>Completed at</dt>
              <dd>{completedAtLabel}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {!readOnly && !completion.canComplete ? (
        <div className="crm-banner crm-banner-error" role="alert">
          <p>Onboarding cannot be completed until blocking issues are resolved.</p>
          <ul className="crm-onboarding-review-issue-list">
            {completion.blockingErrors.slice(0, 12).map((issue) => (
              <li key={`${issue.sectionId ?? 'global'}-${issue.code}-${issue.message}`}>
                {issue.message}
                {issue.sectionId ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="crm-text-btn"
                      onClick={() => onEditSection(issue.sectionId!)}
                    >
                      Edit {getOnboardingSection(issue.sectionId).shortTitle ?? issue.sectionId}
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!readOnly && completion.canComplete ? (
        <p className="crm-banner crm-banner-success" role="status">
          All intake sections are complete. You can finish onboarding. Educational warnings may
          remain for follow-up and do not block completion.
        </p>
      ) : null}

      {completion.warnings.length > 0 ? (
        <div className="crm-banner crm-banner-warning" role="status">
          <p>Educational warnings (not completion blockers):</p>
          <ul className="crm-onboarding-review-issue-list">
            {completion.warnings.map((warning) => (
              <li key={`${warning.sectionId ?? 'global'}-${warning.code}-${warning.message}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="crm-onboarding-review-sections">
        {summaries.map((summary) => (
          <article
            key={summary.sectionId}
            className={`crm-onboarding-review-card ${statusClass(summary.status)}`}
          >
            <header className="crm-onboarding-review-card-head">
              <div>
                <h3 className="crm-onboarding-subtitle">{summary.title}</h3>
                <p className="crm-onboarding-progress-item-state">{summary.statusLabel}</p>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className="crm-secondary-btn"
                  onClick={() => onEditSection(summary.sectionId)}
                >
                  Edit section
                </button>
              ) : null}
            </header>

            {summary.missingRequiredFields.length > 0 ? (
              <p className="crm-muted">
                Missing required: {summary.missingRequiredFields.join(', ')}
              </p>
            ) : null}
            {summary.errors.length > 0 ? (
              <ul className="crm-onboarding-review-issue-list">
                {summary.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            {summary.warnings.length > 0 ? (
              <ul className="crm-onboarding-review-issue-list crm-onboarding-review-warnings">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            <dl className="crm-client-workspace-info-list crm-onboarding-review-highlights">
              {summary.highlights.map((item) => (
                <div key={`${summary.sectionId}-${item.label}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      {!readOnly ? (
        <div className="crm-onboarding-review-complete">
          <button
            type="button"
            className="crm-primary-btn"
            disabled={completing || !completion.canComplete}
            onClick={() => void onComplete()}
          >
            {completing ? 'Completing…' : 'Complete onboarding'}
          </button>
          {!completion.canComplete ? (
            <p className="crm-muted">
              Resolve incomplete sections and validation errors before completing.
            </p>
          ) : (
            <p className="crm-muted">
              Completing marks this draft finished and switches the assessment to read-only. Latest
              answers are saved first.
            </p>
          )}
        </div>
      ) : (
        <p className="crm-muted" role="status">
          This completed onboarding assessment is read-only.
        </p>
      )}
    </section>
  )
}
