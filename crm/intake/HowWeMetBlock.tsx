import type { HowWeMetViewModel } from './howWeMet'

type Props = {
  model: HowWeMetViewModel
  headingId?: string
  className?: string
  showHeading?: boolean
}

/** Read-only How We Met attribution block (CRM only). */
export default function HowWeMetBlock({
  model,
  headingId = 'crm-how-we-met-heading',
  className = 'crm-intake-detail-section',
  showHeading = true,
}: Props) {
  return (
    <section
      className={className}
      aria-labelledby={showHeading ? headingId : undefined}
      aria-label={showHeading ? undefined : 'How We Met'}
    >
      {showHeading ? <h3 id={headingId}>How We Met</h3> : null}
      <dl className="crm-intake-dl">
        <div>
          <dt>Campaign</dt>
          <dd>{model.campaignLabel || '—'}</dd>
        </div>
        <div>
          <dt>Event</dt>
          <dd>{model.eventLabel || '—'}</dd>
        </div>
        <div>
          <dt>Source channel</dt>
          <dd>{model.sourceChannel || '—'}</dd>
        </div>
        <div>
          <dt>Connected date</dt>
          <dd>{model.connectedDate || '—'}</dd>
        </div>
        <div>
          <dt>Card owner</dt>
          <dd>{model.cardOwner || '—'}</dd>
        </div>
        <div>
          <dt>Relationship photo</dt>
          <dd>{model.relationshipPhoto === 'present' ? 'Present' : 'None'}</dd>
        </div>
        <div>
          <dt>Source page</dt>
          <dd>{model.sourcePage || '—'}</dd>
        </div>
        <div>
          <dt>UTM summary</dt>
          <dd>{model.utmSummary || '—'}</dd>
        </div>
      </dl>
    </section>
  )
}
