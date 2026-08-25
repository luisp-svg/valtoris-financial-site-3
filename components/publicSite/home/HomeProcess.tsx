import type { HomeCopy } from './copy'
import SiteHomeSection from './SiteHomeSection'

type HomeProcessProps = {
  copy: HomeCopy
}

export default function HomeProcess({ copy }: HomeProcessProps) {
  const steps = [
    { title: copy.processDiagnoseTitle, body: copy.processDiagnoseBody },
    { title: copy.processPrioritizeTitle, body: copy.processPrioritizeBody },
    { title: copy.processStrategizeTitle, body: copy.processStrategizeBody },
  ]

  return (
    <SiteHomeSection
      tone="blue"
      titleId="home-process-heading"
      title={copy.processHeading}
      lead={copy.processLead}
      kicker={copy.processKicker}
    >
      <ol className="site-home-process">
        {steps.map((step, index) => (
          <li key={step.title} className="site-home-process-step">
            <span className="site-home-process-number" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="site-home-card-title">{step.title}</h3>
            <p className="site-home-card-copy">{step.body}</p>
          </li>
        ))}
      </ol>
    </SiteHomeSection>
  )
}
