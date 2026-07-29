import type { OnboardingSectionConfig } from '../onboardingSections'

type SectionPlaceholderProps = {
  section: OnboardingSectionConfig
}

/** Phase 2 placeholder — real form fields arrive in later phases. */
export default function SectionPlaceholder({ section }: SectionPlaceholderProps) {
  return (
    <section
      className="crm-onboarding-section-placeholder"
      aria-labelledby={`crm-onboarding-section-${section.id}-title`}
    >
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <p className="crm-banner crm-banner-warning" role="status">
        Form content for this section will be implemented in a later phase. Navigation, progress,
        and save/resume foundations are available now.
      </p>
    </section>
  )
}
