import {
  formatSectionUiState,
  type OnboardingProgressSnapshot,
  type OnboardingSectionUiState,
} from './onboardingProgress'
import {
  getOrderedOnboardingSections,
  type OnboardingSectionId,
} from './onboardingSections'

type HouseholdOnboardingProgressProps = {
  progress: OnboardingProgressSnapshot
  currentSectionId: OnboardingSectionId
  statusLabel: string
  onSelectSection: (sectionId: OnboardingSectionId) => void
}

function stateClass(state: OnboardingSectionUiState): string {
  switch (state) {
    case 'complete':
      return 'is-complete'
    case 'in_progress':
      return 'is-in-progress'
    case 'needs_attention':
      return 'is-needs-attention'
    default:
      return 'is-not-started'
  }
}

export default function HouseholdOnboardingProgress({
  progress,
  currentSectionId,
  statusLabel,
  onSelectSection,
}: HouseholdOnboardingProgressProps) {
  const sections = getOrderedOnboardingSections()

  return (
    <aside className="crm-onboarding-progress-panel" aria-label="Onboarding progress">
      <div className="crm-onboarding-progress-head">
        <p className="crm-onboarding-progress-eyebrow">Household Financial Progress Onboarding</p>
        <p className="crm-status-chip">{statusLabel}</p>
      </div>

      <dl className="crm-client-workspace-info-list crm-onboarding-progress-stats">
        <div>
          <dt>Current section</dt>
          <dd>
            {sections.find((section) => section.id === currentSectionId)?.shortTitle ??
              currentSectionId}
          </dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>
            {progress.completedSectionsCount} of {progress.totalSections}
          </dd>
        </div>
        <div>
          <dt>Onboarding completion</dt>
          <dd>{progress.progressPercent}%</dd>
        </div>
      </dl>

      <div
        className="crm-onboarding-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.progressPercent}
        aria-label="Onboarding completion progress"
      >
        <span style={{ width: `${progress.progressPercent}%` }} />
      </div>

      <ol className="crm-onboarding-progress-list">
        {sections.map((section) => {
          const state = progress.sectionStates[section.id]
          const current = section.id === currentSectionId
          return (
            <li key={section.id}>
              <button
                type="button"
                className={`crm-onboarding-progress-item ${stateClass(state)}${
                  current ? ' is-current' : ''
                }`}
                onClick={() => onSelectSection(section.id)}
                aria-current={current ? 'step' : undefined}
              >
                <span className="crm-onboarding-progress-item-title">
                  {section.shortTitle ?? section.title}
                </span>
                <span className="crm-onboarding-progress-item-state">
                  {formatSectionUiState(state)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
