import type { ServiceCopy } from './copy'
import SiteHomeSection from '../home/SiteHomeSection'

type ServiceProcessProps = {
  copy: ServiceCopy
}

export default function ServiceProcess({ copy }: ServiceProcessProps) {
  return (
    <SiteHomeSection
      id="service-process"
      tone="gray"
      titleId="service-process-heading"
      title={copy.processHeading}
      lead={copy.processLead}
    >
      <ol className="site-service-process">
        {copy.processSteps.map((step, index) => (
          <li key={step.title} className="site-home-process-step">
            <span className="site-home-process-number" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="site-home-card-title">{step.title}</h3>
            <p className="site-home-card-copy">{step.body}</p>
          </li>
        ))}
      </ol>
      <p className="site-service-process-note">{copy.processNote}</p>
    </SiteHomeSection>
  )
}
