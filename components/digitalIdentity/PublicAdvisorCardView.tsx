import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandWordmark from '../BrandWordmark'
import { ROUTES } from '../../constants/routes'
import type { IdentitySurfacePublicDto } from '../../modules/digital-identity'
import type { PublicCardQrFormat } from '../../modules/digital-identity'
import {
  downloadPublicCardQr,
  qrDownloadErrorCopy,
  qrDownloadMenuItems,
  triggerQrBrowserDownload,
} from './downloadPublicCardQr'
import {
  downloadPublicCardVCard,
  triggerVCardBrowserDownload,
} from './downloadPublicCardVCard'
import LetsConnectModal from './LetsConnectModal'
import {
  buildDiagnosticActions,
  buildHeroActions,
  buildOutcomeSections,
  errorCopyForStatus,
  getInitials,
  publicCardLayoutClasses,
  resolveContactVisibility,
  vCardDownloadErrorCopy,
  type PublicCardPageStatus,
} from './publicCardViewModel'

type ReadyProps = {
  status: 'ready'
  card: IdentitySurfacePublicDto
}

type PendingProps = {
  status: Exclude<PublicCardPageStatus, 'ready'>
  card?: null
}

export type PublicAdvisorCardViewProps = ReadyProps | PendingProps

function Headshot({
  name,
  url,
}: {
  name: string
  url: string | null
}) {
  if (url) {
    return (
      <img
        className="public-card-headshot"
        src={url}
        alt={`${name} headshot`}
        width={128}
        height={128}
        loading="eager"
        decoding="async"
      />
    )
  }

  return (
    <div className="public-card-headshot public-card-headshot--fallback" aria-hidden="true">
      <span>{getInitials(name)}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <section className="public-card-state" aria-busy="true" aria-live="polite">
      <div className="public-card-skeleton public-card-skeleton--avatar" />
      <div className="public-card-skeleton public-card-skeleton--line" />
      <div className="public-card-skeleton public-card-skeleton--line public-card-skeleton--short" />
      <p className="public-card-state-copy">Loading advisor card…</p>
    </section>
  )
}

function ErrorState({ status }: { status: Exclude<PublicCardPageStatus, 'loading' | 'ready'> }) {
  const copy = errorCopyForStatus(status)
  return (
    <section className="public-card-state" aria-live="polite">
      <BrandWordmark variant="assessment" className="public-card-brand" />
      <h1 className="public-card-state-title">{copy.title}</h1>
      <p className="public-card-state-copy">{copy.message}</p>
      <div className="platform-btn-row platform-btn-row--center">
        <Link className="platform-btn platform-btn-primary" to={ROUTES.home}>
          Return Home
        </Link>
        <Link className="platform-btn platform-btn-outline" to={ROUTES.privacy}>
          Privacy
        </Link>
      </div>
    </section>
  )
}

function ReadyCard({ card }: { card: IdentitySurfacePublicDto }) {
  const layout = publicCardLayoutClasses()
  const contact = resolveContactVisibility(card)
  const heroActions = buildHeroActions(card)
  const diagnostics = buildDiagnosticActions(card)
  const outcomes = buildOutcomeSections(card)
  const metaLine = [card.approvedTitle, card.approvedCompany].filter(Boolean).join(' · ')
  const [vcardStatus, setVcardStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [vcardMessage, setVcardMessage] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [qrMessage, setQrMessage] = useState<string | null>(null)
  const [qrLoadingFormat, setQrLoadingFormat] = useState<PublicCardQrFormat | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)

  async function handleSaveContact() {
    if (vcardStatus === 'loading') return
    setVcardStatus('loading')
    setVcardMessage(null)

    const result = await downloadPublicCardVCard({ key: card.publicKey })
    if (!result.ok) {
      setVcardStatus('error')
      setVcardMessage(vCardDownloadErrorCopy(result.code))
      return
    }

    const saved = triggerVCardBrowserDownload(result.body, result.filename)
    if (!saved) {
      setVcardStatus('error')
      setVcardMessage(vCardDownloadErrorCopy('generation_failure'))
      return
    }

    setVcardStatus('idle')
    setVcardMessage(null)
  }

  async function handleDownloadQr(format: PublicCardQrFormat) {
    if (qrStatus === 'loading') return
    setQrStatus('loading')
    setQrLoadingFormat(format)
    setQrMessage(null)

    const result = await downloadPublicCardQr({ key: card.publicKey, format })
    if (!result.ok) {
      setQrStatus('error')
      setQrLoadingFormat(null)
      setQrMessage(qrDownloadErrorCopy(result.code))
      return
    }

    const saved = triggerQrBrowserDownload(result.blob, result.filename)
    if (!saved) {
      setQrStatus('error')
      setQrLoadingFormat(null)
      setQrMessage(qrDownloadErrorCopy('malformed_response'))
      return
    }

    setQrStatus('idle')
    setQrLoadingFormat(null)
    setQrMessage(null)
  }

  return (
    <>
      <section className={layout.hero} aria-labelledby="public-card-name">
        <div className="public-card-hero-inner">
          <Headshot name={card.displayName} url={card.headshotUrl} />
          <h1 id="public-card-name" className="public-card-name">
            {card.displayName}
          </h1>
          {metaLine ? <p className="public-card-meta">{metaLine}</p> : null}
          {card.headline ? <p className="public-card-headline">{card.headline}</p> : null}

          {(contact.showPhone || contact.showEmail || contact.showWebsite) && (
            <ul className="public-card-contact-list">
              {contact.showPhone ? (
                <li>
                  <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                </li>
              ) : null}
              {contact.showEmail ? (
                <li>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
              ) : null}
              {contact.showWebsite ? (
                <li>
                  <a href={contact.website!} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                </li>
              ) : null}
            </ul>
          )}

          <div className="public-card-hero-actions platform-btn-row platform-btn-row--center">
            {heroActions.map((action) => {
              if (action.mode === 'external_link' && action.href) {
                return (
                  <a
                    key={action.key}
                    className="platform-btn platform-btn-secondary public-card-btn"
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {action.label}
                  </a>
                )
              }

              if (action.mode === 'vcard_download') {
                return (
                  <button
                    key={action.key}
                    type="button"
                    className="platform-btn platform-btn-secondary public-card-btn"
                    onClick={() => {
                      void handleSaveContact()
                    }}
                    disabled={vcardStatus === 'loading'}
                    aria-busy={vcardStatus === 'loading'}
                  >
                    {vcardStatus === 'loading' ? 'Preparing…' : action.label}
                  </button>
                )
              }

              if (action.mode === 'opens_connect_form') {
                return (
                  <button
                    key={action.key}
                    type="button"
                    className="platform-btn platform-btn-primary public-card-btn"
                    onClick={() => setConnectOpen(true)}
                  >
                    {action.label}
                  </button>
                )
              }

              return null
            })}
          </div>
          {vcardMessage ? (
            <p className="public-card-download-error" role="alert">
              {vcardMessage}
            </p>
          ) : null}

          <details className="public-card-qr-menu">
            <summary className="platform-btn platform-btn-outline public-card-btn">
              {qrStatus === 'loading' ? 'Preparing QR…' : 'Download QR'}
            </summary>
            <div className="public-card-qr-options" role="menu" aria-label="QR download formats">
              {qrDownloadMenuItems().map((item) => (
                <button
                  key={item.format}
                  type="button"
                  role="menuitem"
                  className="public-card-qr-option"
                  disabled={qrStatus === 'loading'}
                  aria-busy={qrLoadingFormat === item.format}
                  onClick={() => {
                    void handleDownloadQr(item.format)
                  }}
                >
                  {qrLoadingFormat === item.format ? 'Preparing…' : item.label}
                </button>
              ))}
            </div>
          </details>
          {qrMessage ? (
            <p className="public-card-download-error" role="alert">
              {qrMessage}
            </p>
          ) : null}
        </div>
      </section>

      <section className={layout.outcomes} aria-labelledby="public-card-help-title">
        <div className="public-card-section-heading">
          <h2 id="public-card-help-title">How I Can Help</h2>
          <p>Practical outcomes — not a product list.</p>
        </div>
        <div className={layout.outcomeGrid}>
          {outcomes.map((outcome) => {
            const body = (
              <>
                <div className="public-card-outcome-top">
                  <h3>{outcome.title}</h3>
                  {outcome.comingSoon ? (
                    <span className="public-card-badge">Coming Soon</span>
                  ) : null}
                </div>
                <p>{outcome.description}</p>
                {!outcome.comingSoon && outcome.actionLabel ? (
                  <span className="public-card-outcome-link">{outcome.actionLabel}</span>
                ) : null}
              </>
            )

            if (outcome.comingSoon || !outcome.href) {
              return (
                <article
                  key={outcome.key}
                  className="public-card-outcome public-card-outcome--soon"
                  aria-disabled="true"
                >
                  {body}
                </article>
              )
            }

            const isExternal = outcome.href.startsWith('http')
            if (isExternal) {
              return (
                <a
                  key={outcome.key}
                  className="public-card-outcome"
                  href={outcome.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {body}
                </a>
              )
            }

            return (
              <Link key={outcome.key} className="public-card-outcome" to={outcome.href}>
                {body}
              </Link>
            )
          })}
        </div>
      </section>

      {diagnostics.length > 0 ? (
        <section className="public-card-diagnostics" aria-labelledby="public-card-tools-title">
          <div className="public-card-section-heading">
            <h2 id="public-card-tools-title">Tools & Diagnostics</h2>
            <p>Start with a clear picture of where you stand.</p>
          </div>
          <div className="public-card-diagnostic-list">
            {diagnostics.map((item) => {
              if (item.mode === 'coming_soon' || !item.href) {
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="public-card-diagnostic"
                    disabled
                    aria-disabled="true"
                  >
                    <span>{item.label}</span>
                    <span className="public-card-badge">Coming Soon</span>
                  </button>
                )
              }

              const isExternal = item.href.startsWith('http')
              if (isExternal) {
                return (
                  <a
                    key={item.key}
                    className="public-card-diagnostic"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>{item.label}</span>
                  </a>
                )
              }

              return (
                <Link key={item.key} className="public-card-diagnostic" to={item.href}>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      {card.bio ? (
        <section className="public-card-about" aria-labelledby="public-card-about-title">
          <div className="public-card-section-heading">
            <h2 id="public-card-about-title">About</h2>
          </div>
          <p className="public-card-bio">{card.bio}</p>
        </section>
      ) : null}

      {card.specialties.length > 0 ? (
        <section className="public-card-specialties" aria-labelledby="public-card-specialties-title">
          <div className="public-card-section-heading">
            <h2 id="public-card-specialties-title">Specialties</h2>
          </div>
          <ul className="public-card-specialty-list">
            {card.specialties.map((specialty) => (
              <li key={specialty}>{specialty}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {card.socialLinks.length > 0 ? (
        <section className="public-card-social" aria-labelledby="public-card-social-title">
          <div className="public-card-section-heading">
            <h2 id="public-card-social-title">Connect Online</h2>
          </div>
          <ul className="public-card-social-list">
            {card.socialLinks.map((link) => (
              <li key={link.key}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <LetsConnectModal
        open={connectOpen}
        cardPublicKey={card.publicKey}
        cardDisplayName={card.displayName}
        sourcePage={
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search || ''}`
            : card.cardUrl
        }
        onClose={() => setConnectOpen(false)}
      />
    </>
  )
}

export default function PublicAdvisorCardView(props: PublicAdvisorCardViewProps) {
  const layout = publicCardLayoutClasses()

  return (
    <div className={layout.page}>
      <div className={layout.shell}>
        {props.status === 'loading' ? <LoadingState /> : null}
        {props.status !== 'loading' && props.status !== 'ready' ? (
          <ErrorState status={props.status} />
        ) : null}
        {props.status === 'ready' ? <ReadyCard card={props.card} /> : null}

        <footer className="public-card-footer">
          <Link to={ROUTES.privacy}>Privacy</Link>
          <span aria-hidden="true">·</span>
          <span className="public-card-powered">
            Powered by <strong>Valtoris</strong>
          </span>
        </footer>
      </div>
    </div>
  )
}
