import {
  getOrderedOnboardingSections,
  type OnboardingSectionId,
} from './onboardingSections'
import type { OnboardingProgressSnapshot } from './onboardingProgress'

type HouseholdOnboardingNavigationProps = {
  currentSectionId: OnboardingSectionId
  progress: OnboardingProgressSnapshot
  onSelectSection: (sectionId: OnboardingSectionId) => void
}

/** Compact / mobile-friendly section navigation driven by centralized metadata. */
export default function HouseholdOnboardingNavigation({
  currentSectionId,
  progress,
  onSelectSection,
}: HouseholdOnboardingNavigationProps) {
  const sections = getOrderedOnboardingSections()

  return (
    <nav className="crm-onboarding-nav-scroll" aria-label="Onboarding sections">
      <ol className="crm-onboarding-nav-scroll-list">
        {sections.map((section) => {
          const current = section.id === currentSectionId
          const state = progress.sectionStates[section.id]
          return (
            <li key={section.id}>
              <button
                type="button"
                className={`crm-onboarding-nav-chip${current ? ' is-current' : ''}${
                  state === 'complete' ? ' is-complete' : ''
                }`}
                onClick={() => onSelectSection(section.id)}
                aria-current={current ? 'step' : undefined}
              >
                {section.shortTitle ?? section.title}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
