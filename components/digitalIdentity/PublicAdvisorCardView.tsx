import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandWordmark from '../BrandWordmark'
import HomeCardIcon, { type HomeCardIconVariant } from '../home/HomeCardIcon'
import { ROUTES } from '../../constants/routes'
import {
  VALTORIS_PUBLIC_TAGLINE,
  type IdentitySocialLink,
  type IdentitySurfacePublicDto,
} from '../../modules/digital-identity'
import {
  downloadPublicCardVCard,
  triggerVCardBrowserDownload,
} from './downloadPublicCardVCard'
import LetsConnectModal from './LetsConnectModal'
import {
  buildHeroActions,
  buildOutcomeSections,
  buildPublicMailtoHref,
  buildPublicTelHref,
  errorCopyForStatus,
  formatPublicPhoneDisplay,
  getInitials,
  publicCardLayoutClasses,
  resolveContactVisibility,
  selectConfiguredSocialLinks,
  selectPublicCardHelpTiles,
  vCardDownloadErrorCopy,
  type PublicCardHelpTileKey,
  type PublicCardHeroAction,
  type PublicCardPageStatus,
} from './publicCardViewModel'

const HELP_TILE_ICONS: Record<PublicCardHelpTileKey, HomeCardIconVariant> = {
  protect_family: 'protection',
  protection_gap: 'emergency',
  grow_business: 'strategy',
  prepare_retirement: 'retirement',
}

function heroActionClassName(key: PublicCardHeroAction['key']): string {
  switch (key) {
    case 'call':
      return 'platform-btn public-card-btn public-card-btn--call'
    case 'text':
      return 'platform-btn public-card-btn public-card-btn--text'
    case 'email':
    case 'save_contact':
      return 'platform-btn public-card-btn public-card-btn--light'
    case 'lets_connect':
      return 'platform-btn public-card-btn public-card-btn--connect'
    case 'book_appointment':
      return 'platform-btn public-card-btn public-card-btn--book'
    default:
      return 'platform-btn public-card-btn public-card-btn--light'
  }
}

function StrokeIcon({
  d,
  className,
  size = 16,
}: {
  d: string
  className?: string
  size?: number
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={d}
      />
    </svg>
  )
}

function ContactGlyph({ kind }: { kind: 'phone' | 'email' | 'web' }) {
  const d =
    kind === 'phone'
      ? 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z'
      : kind === 'email'
        ? 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75'
        : 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5 0 4.5-4 4.5-9S14.5 3 12 3 7.5 7 7.5 12s2 9 4.5 9Zm-9-9h18'
  return <StrokeIcon className="public-card-contact-icon" d={d} />
}

function ActionGlyph({ kind }: { kind: PublicCardHeroAction['key'] }) {
  const d =
    kind === 'call'
      ? 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z'
      : kind === 'text'
        ? 'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z'
        : kind === 'email'
          ? 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75'
          : kind === 'save_contact'
            ? 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z'
            : kind === 'book_appointment'
              ? 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5'
              : 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z'
  return <StrokeIcon className="public-card-action-icon" d={d} size={18} />
}

function SocialGlyph({ network }: { network: string }) {
  const key = network.trim().toLowerCase()
  const d =
    key === 'linkedin'
      ? 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'
      : key === 'instagram'
        ? 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5zM17.5 7a1 1 0 1 1-1-1 1 1 0 0 1 1 1z'
        : key === 'facebook'
          ? 'M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z'
          : key === 'youtube'
            ? 'M22.5 7.2a3 3 0 0 0-2.1-2.1C18.6 4.6 12 4.6 12 4.6s-6.6 0-8.4.5A3 3 0 0 0 1.5 7.2 31 31 0 0 0 1 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.8.5 8.4.5 8.4.5s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23 12a31 31 0 0 0-.5-4.8zM10 15.5v-7l6 3.5z'
            : key === 'tiktok'
              ? 'M14 4c.6 2.4 2.2 4.2 4.5 4.7V12c-1.6-.05-3.1-.6-4.5-1.5V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.08V13A2.5 2.5 0 1 0 12 15.5V4h2z'
              : key === 'twitter' || key === 'x'
                ? 'M4 4l6.7 8.2L4.3 20h3.2l5-6.1L17.8 20H20l-7-8.6L19.6 4h-3.2l-4.6 5.6L6.3 4H4z'
                : 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5 0 4.5-4 4.5-9S14.5 3 12 3 7.5 7 7.5 12s2 9 4.5 9Zm-9-9h18'
  return <StrokeIcon className="public-card-social-icon" d={d} size={18} />
}

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
  return (
    <div className="public-card-headshot-wrap">
      {url ? (
        <img
          className="public-card-headshot"
          src={url}
          alt={`${name} headshot`}
          width={168}
          height={168}
          loading="eager"
          decoding="async"
        />
      ) : (
        <div className="public-card-headshot public-card-headshot--fallback" aria-hidden="true">
          <span>{getInitials(name)}</span>
        </div>
      )}
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

function BrandBlock({ className }: { className: string }) {
  return (
    <div className={className}>
      <BrandWordmark variant="assessment" className="public-card-brand public-card-brand--hero" />
      <p className="public-card-tagline">{VALTORIS_PUBLIC_TAGLINE}</p>
    </div>
  )
}

function SocialRow({ links }: { links: readonly IdentitySocialLink[] }) {
  if (links.length === 0) return null
  return (
    <ul className="public-card-social-list">
      {links.map((link) => (
        <li key={link.key}>
          <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
            <SocialGlyph network={link.key} />
            <span>{link.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function ReadyCard({ card }: { card: IdentitySurfacePublicDto }) {
  const layout = publicCardLayoutClasses()
  const contact = resolveContactVisibility(card)
  const telHref = buildPublicTelHref(contact.phone)
  const mailHref = buildPublicMailtoHref(contact.email)
  const phoneDisplay = formatPublicPhoneDisplay(contact.phone)
  const heroActions = buildHeroActions(card)
  const outcomes = selectPublicCardHelpTiles(buildOutcomeSections(card))
  const socialLinks = selectConfiguredSocialLinks(card)
  const title = card.approvedTitle?.trim() || ''
  const company = card.approvedCompany?.trim() || ''
  const [vcardStatus, setVcardStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [vcardMessage, setVcardMessage] = useState<string | null>(null)
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

  return (
    <>
      <section className={layout.hero} aria-labelledby="public-card-name">
        <BrandBlock className="public-card-hero-brand" />
        <div className="public-card-hero-inner">
          <Headshot name={card.displayName} url={card.headshotUrl} />
          <h1 id="public-card-name" className="public-card-name">
            {card.displayName}
          </h1>
          {title ? <p className="public-card-meta-title">{title}</p> : null}
          {company ? <p className="public-card-meta-company">{company}</p> : null}
          {card.headline ? <p className="public-card-headline">{card.headline}</p> : null}

          {((contact.showPhone && telHref) || (contact.showEmail && mailHref) || contact.showWebsite) && (
            <ul className="public-card-contact-list">
              {contact.showPhone && telHref ? (
                <li>
                  <a href={telHref}>
                    <ContactGlyph kind="phone" />
                    {phoneDisplay ?? contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.showEmail && mailHref ? (
                <li>
                  <a href={mailHref}>
                    <ContactGlyph kind="email" />
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.showWebsite ? (
                <li>
                  <a href={contact.website!} target="_blank" rel="noopener noreferrer">
                    <ContactGlyph kind="web" />
                    Website
                  </a>
                </li>
              ) : null}
            </ul>
          )}

          <div className="public-card-hero-actions">
            {heroActions.map((action) => {
              const className = heroActionClassName(action.key)
              const label = (
                <>
                  <ActionGlyph kind={action.key} />
                  <span>{action.label}</span>
                </>
              )
              if (action.mode === 'contact_link' && action.href) {
                return (
                  <a key={action.key} className={className} href={action.href}>
                    {label}
                  </a>
                )
              }

              if (action.mode === 'external_link' && action.href) {
                return (
                  <a
                    key={action.key}
                    className={className}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                  </a>
                )
              }

              if (action.mode === 'vcard_download') {
                return (
                  <button
                    key={action.key}
                    type="button"
                    className={className}
                    onClick={() => {
                      void handleSaveContact()
                    }}
                    disabled={vcardStatus === 'loading'}
                    aria-busy={vcardStatus === 'loading'}
                  >
                    <ActionGlyph kind={action.key} />
                    <span>{vcardStatus === 'loading' ? 'Preparing…' : action.label}</span>
                  </button>
                )
              }

              if (action.mode === 'opens_connect_form') {
                return (
                  <button
                    key={action.key}
                    type="button"
                    className={className}
                    onClick={() => setConnectOpen(true)}
                  >
                    {label}
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
        </div>
      </section>

      <section className={layout.outcomes} aria-labelledby="public-card-help-title">
        <div className="public-card-section-heading">
          <h2 id="public-card-help-title">How I Can Help</h2>
        </div>
        <div className={layout.outcomeGrid}>
          {outcomes.map((outcome) => {
            const iconVariant = HELP_TILE_ICONS[outcome.key as PublicCardHelpTileKey]
            const body = (
              <>
                {iconVariant ? (
                  <span className="public-card-outcome-icon">
                    <HomeCardIcon variant={iconVariant} />
                  </span>
                ) : null}
                <h3>{outcome.title}</h3>
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

      {socialLinks.length > 0 ? (
        <section className="public-card-social" aria-labelledby="public-card-social-title">
          <div className="public-card-section-heading">
            <h2 id="public-card-social-title">Connect With Me</h2>
          </div>
          <SocialRow links={socialLinks} />
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

function PublicCardFooter({ socialLinks }: { socialLinks: readonly IdentitySocialLink[] }) {
  return (
    <footer className="public-card-footer">
      <BrandBlock className="public-card-footer-brand" />
      {socialLinks.length > 0 ? (
        <SocialRow links={socialLinks} />
      ) : null}
      <Link className="public-card-footer-privacy" to={ROUTES.privacy}>
        Privacy
      </Link>
    </footer>
  )
}

export default function PublicAdvisorCardView(props: PublicAdvisorCardViewProps) {
  const layout = publicCardLayoutClasses()
  const socialLinks =
    props.status === 'ready' ? selectConfiguredSocialLinks(props.card) : []

  return (
    <div className={layout.page}>
      <div className={layout.shell}>
        {props.status === 'loading' ? <LoadingState /> : null}
        {props.status !== 'loading' && props.status !== 'ready' ? (
          <ErrorState status={props.status} />
        ) : null}
        {props.status === 'ready' ? <ReadyCard card={props.card} /> : null}
      </div>
      <PublicCardFooter socialLinks={socialLinks} />
    </div>
  )
}
