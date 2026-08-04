import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import {
  downloadPublicCardVCard,
  triggerVCardBrowserDownload,
} from './downloadPublicCardVCard'
import {
  applyPhoneToLetsConnectConsent,
  buildLetsConnectSubmitBody,
  createEmptyLetsConnectFormValues,
  createLetsConnectSubmissionId,
  LETS_CONNECT_FOLLOW_UP_OPTIONS,
  LETS_CONNECT_REASON_OPTIONS,
  letsConnectModalCopy,
  validateLetsConnectFormClient,
  type LetsConnectFormValues,
} from './letsConnectForm'
import {
  prepareRelationshipPhotoFile,
  relationshipPhotoCopy,
  submitRelationshipPhoto,
  type RelationshipPhotoClientAvailability,
} from './relationshipPhotoClient'
import { getCardAttributionSession } from './campaignAttributionSession'
import { submitLetsConnect } from './submitLetsConnect'
import { vCardDownloadErrorCopy } from './publicCardViewModel'

export type LetsConnectModalProps = {
  open: boolean
  cardPublicKey: string
  cardDisplayName: string
  onClose: () => void
  sourcePage?: string | null
  campaignCode?: string | null
  eventCode?: string | null
}

type Phase = 'form' | 'submitting' | 'success' | 'photo' | 'photo_saving' | 'photo_saved'

export default function LetsConnectModal({
  open,
  cardPublicKey,
  cardDisplayName,
  onClose,
  sourcePage = null,
  campaignCode = null,
  eventCode = null,
}: LetsConnectModalProps) {
  const titleId = useId()
  const subtitleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('form')
  const [values, setValues] = useState<LetsConnectFormValues>(createEmptyLetsConnectFormValues)
  const [formStartedAt, setFormStartedAt] = useState<string | null>(null)
  const [clientErrors, setClientErrors] = useState<
    ReturnType<typeof validateLetsConnectFormClient>['errors']
  >({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [vcardStatus, setVcardStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [vcardMessage, setVcardMessage] = useState<string | null>(null)
  const [photoGrant, setPhotoGrant] = useState<RelationshipPhotoClientAvailability>({
    available: false,
  })
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoAcknowledged, setPhotoAcknowledged] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const copy = letsConnectModalCopy()
  const photoCopy = relationshipPhotoCopy()
  const smsDisabled = !values.phone.trim()

  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase

  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPhase('form')
    setValues(createEmptyLetsConnectFormValues())
    setFormStartedAt(new Date().toISOString())
    setClientErrors({})
    setSubmitError(null)
    setVcardStatus('idle')
    setVcardMessage(null)
    setPhotoGrant({ available: false })
    setPhotoPreviewUrl(null)
    setPhotoBase64(null)
    setPhotoAcknowledged(false)
    setPhotoError(null)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      firstFieldRef.current?.focus()
    }, 0)

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === 'Escape' &&
        phaseRef.current !== 'submitting' &&
        phaseRef.current !== 'photo_saving'
      ) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  function updateField<K extends keyof LetsConnectFormValues>(
    key: K,
    value: LetsConnectFormValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'phone' && typeof value === 'string') {
        next.consent = applyPhoneToLetsConnectConsent(prev.consent, value)
      }
      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (phase === 'submitting') return

    const validation = validateLetsConnectFormClient(values)
    setClientErrors(validation.errors)
    if (!validation.ok) return

    const startedAt = formStartedAt ?? new Date().toISOString()
    const submittedAt = new Date().toISOString()
    const submissionId = createLetsConnectSubmissionId()

    setPhase('submitting')
    setSubmitError(null)

    const sessionAttrib = getCardAttributionSession(cardPublicKey)
    const first = sessionAttrib?.firstTouch
    const body = buildLetsConnectSubmitBody({
      values,
      cardPublicKey,
      submissionId,
      formStartedAt: startedAt,
      formSubmittedAt: submittedAt,
      sourcePage:
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search || ''}`
          : sourcePage,
      campaignCode: first?.campaignCode ?? campaignCode,
      eventCode: first?.eventCode ?? eventCode,
      sourceChannel: first?.sourceChannel ?? null,
      utmSource: first?.utmSource ?? null,
      utmMedium: first?.utmMedium ?? null,
      utmCampaign: first?.utmCampaign ?? null,
      utmTerm: first?.utmTerm ?? null,
      utmContent: first?.utmContent ?? null,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    })

    const result = await submitLetsConnect(body)
    if (!result.ok) {
      setPhase('form')
      setSubmitError(result.error)
      return
    }

    setPhotoGrant(result.relationshipPhoto)
    setPhase('success')
  }

  async function handlePhotoFile(file: File | null) {
    if (!file) return
    setPhotoError(null)
    try {
      const prepared = await prepareRelationshipPhotoFile(file)
      setPhotoPreviewUrl(prepared.dataUrl)
      setPhotoBase64(prepared.dataUrl)
    } catch {
      setPhotoError(photoCopy.failure)
      setPhotoPreviewUrl(null)
      setPhotoBase64(null)
    }
  }

  async function handleSavePhoto() {
    if (!photoGrant.available || !photoBase64 || phase === 'photo_saving') return
    if (!photoAcknowledged) {
      setPhotoError('Please acknowledge photo storage before saving a photo.')
      return
    }
    setPhase('photo_saving')
    setPhotoError(null)
    const result = await submitRelationshipPhoto({
      uploadToken: photoGrant.uploadToken,
      photoAcknowledgment: true,
      imageBase64: photoBase64,
    })
    if (!result.ok) {
      setPhase('photo')
      setPhotoError(result.error || photoCopy.failure)
      return
    }
    setPhase('photo_saved')
  }

  async function handleSaveContact() {
    if (vcardStatus === 'loading') return
    setVcardStatus('loading')
    setVcardMessage(null)

    const result = await downloadPublicCardVCard({ key: cardPublicKey })
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
    <div className="public-card-connect-backdrop" role="presentation">
      <button
        type="button"
        className="public-card-connect-scrim"
        aria-label="Close Let's Connect"
        disabled={phase === 'submitting'}
        onClick={() => {
          if (phase !== 'submitting') onClose()
        }}
      />
      <div
        ref={panelRef}
        className="public-card-connect-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={phase === 'form' ? subtitleId : undefined}
        data-card-owner={cardDisplayName || undefined}
      >
        {phase === 'success' ||
        phase === 'photo' ||
        phase === 'photo_saving' ||
        phase === 'photo_saved' ? (
          <div className="public-card-connect-success">
            <h2 id={titleId} className="public-card-connect-title">
              {phase === 'photo_saved' ? photoCopy.success : copy.successTitle}
            </h2>

            {phase === 'success' || phase === 'photo_saved' ? (
              <div className="public-card-connect-success-actions">
                <button
                  type="button"
                  className="platform-btn platform-btn-primary public-card-btn"
                  onClick={() => {
                    void handleSaveContact()
                  }}
                  disabled={vcardStatus === 'loading'}
                  aria-busy={vcardStatus === 'loading'}
                >
                  {vcardStatus === 'loading' ? 'Preparing…' : copy.successSaveContact}
                </button>
                <Link
                  className="platform-btn platform-btn-secondary public-card-btn"
                  to={ROUTES.familyAssessment}
                >
                  {copy.successFamilyAssessment}
                </Link>
                {phase === 'success' && photoGrant.available ? (
                  <button
                    type="button"
                    className="platform-btn platform-btn-outline public-card-btn"
                    onClick={() => {
                      setPhotoError(null)
                      setPhase('photo')
                    }}
                  >
                    {copy.successAddPhoto}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="platform-btn platform-btn-outline public-card-btn"
                  onClick={onClose}
                >
                  {copy.successDone}
                </button>
              </div>
            ) : null}

            {phase === 'photo' || phase === 'photo_saving' ? (
              <div className="public-card-connect-photo-panel">
                <h3 className="public-card-connect-photo-title">{photoCopy.title}</h3>
                <p className="public-card-connect-photo-body">{photoCopy.body}</p>
                <p className="public-card-connect-photo-soft">{photoCopy.softBody}</p>
                <p className="public-card-connect-photo-disclosure">{photoCopy.disclosure}</p>

                <label className="public-card-connect-check">
                  <input
                    type="checkbox"
                    checked={photoAcknowledged}
                    onChange={(event) => setPhotoAcknowledged(event.target.checked)}
                    disabled={phase === 'photo_saving'}
                  />
                  <span>{photoCopy.acknowledgment}</span>
                </label>

                {photoPreviewUrl ? (
                  <div className="public-card-connect-photo-preview-wrap">
                    <img
                      src={photoPreviewUrl}
                      alt="Relationship photo preview"
                      className="public-card-connect-photo-preview"
                    />
                  </div>
                ) : null}

                <div className="public-card-connect-success-actions">
                  <button
                    type="button"
                    className="platform-btn platform-btn-primary public-card-btn"
                    onClick={() => selfieInputRef.current?.click()}
                    disabled={phase === 'photo_saving'}
                  >
                    {photoPreviewUrl ? photoCopy.retake : photoCopy.takeSelfie}
                  </button>
                  <button
                    type="button"
                    className="platform-btn platform-btn-secondary public-card-btn"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={phase === 'photo_saving'}
                  >
                    {photoCopy.uploadPhoto}
                  </button>
                  {photoPreviewUrl ? (
                    <>
                      <button
                        type="button"
                        className="platform-btn platform-btn-primary public-card-btn"
                        onClick={() => {
                          void handleSavePhoto()
                        }}
                        disabled={phase === 'photo_saving' || !photoAcknowledged}
                      >
                        {phase === 'photo_saving' ? photoCopy.saving : photoCopy.savePhoto}
                      </button>
                      <button
                        type="button"
                        className="platform-btn platform-btn-outline public-card-btn"
                        onClick={() => {
                          setPhotoPreviewUrl(null)
                          setPhotoBase64(null)
                        }}
                        disabled={phase === 'photo_saving'}
                      >
                        {photoCopy.remove}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="platform-btn platform-btn-outline public-card-btn"
                    onClick={() => {
                      setPhotoPreviewUrl(null)
                      setPhotoBase64(null)
                      setPhotoAcknowledged(false)
                      setPhotoError(null)
                      setPhase('success')
                    }}
                    disabled={phase === 'photo_saving'}
                  >
                    {photoCopy.skip}
                  </button>
                </div>

                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  className="public-card-connect-honeypot-input"
                  tabIndex={-1}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    void handlePhotoFile(file)
                    event.currentTarget.value = ''
                  }}
                />
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="public-card-connect-honeypot-input"
                  tabIndex={-1}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    void handlePhotoFile(file)
                    event.currentTarget.value = ''
                  }}
                />
              </div>
            ) : null}

            {vcardMessage ? (
              <p className="public-card-download-error" role="alert">
                {vcardMessage}
              </p>
            ) : null}
            {photoError ? (
              <p className="public-card-download-error" role="alert">
                {photoError}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <header className="public-card-connect-header">
              <div>
                <h2 id={titleId} className="public-card-connect-title">
                  {copy.title}
                </h2>
                <p id={subtitleId} className="public-card-connect-subtitle">
                  {copy.subtitle}
                </p>
                <p className="public-card-connect-supporting">{copy.supporting}</p>
              </div>
              <button
                type="button"
                className="public-card-connect-close"
                onClick={onClose}
                disabled={phase === 'submitting'}
              >
                Close
              </button>
            </header>

            <form className="public-card-connect-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <div className="public-card-connect-field-row">
                <label className="public-card-connect-field">
                  <span>First name</span>
                  <input
                    ref={firstFieldRef}
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    value={values.firstName}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    required
                    disabled={phase === 'submitting'}
                    aria-invalid={Boolean(clientErrors.firstName)}
                  />
                  {clientErrors.firstName ? (
                    <span className="public-card-connect-field-error">{clientErrors.firstName}</span>
                  ) : null}
                </label>
                <label className="public-card-connect-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    value={values.lastName}
                    onChange={(event) => updateField('lastName', event.target.value)}
                    required
                    disabled={phase === 'submitting'}
                    aria-invalid={Boolean(clientErrors.lastName)}
                  />
                  {clientErrors.lastName ? (
                    <span className="public-card-connect-field-error">{clientErrors.lastName}</span>
                  ) : null}
                </label>
              </div>

              <div className="public-card-connect-field-row">
                <label className="public-card-connect-field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={values.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    disabled={phase === 'submitting'}
                    aria-invalid={Boolean(clientErrors.contact)}
                  />
                </label>
                <label className="public-card-connect-field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    value={values.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    disabled={phase === 'submitting'}
                    aria-invalid={Boolean(clientErrors.contact)}
                  />
                </label>
              </div>
              {clientErrors.contact ? (
                <p className="public-card-connect-field-error" role="alert">
                  {clientErrors.contact}
                </p>
              ) : (
                <p className="public-card-connect-hint">Email or phone — at least one is required.</p>
              )}

              <div className="public-card-connect-field-row">
                <label className="public-card-connect-field">
                  <span>Company (optional)</span>
                  <input
                    type="text"
                    name="company"
                    autoComplete="organization"
                    value={values.company}
                    onChange={(event) => updateField('company', event.target.value)}
                    disabled={phase === 'submitting'}
                  />
                </label>
                <label className="public-card-connect-field">
                  <span>Job title (optional)</span>
                  <input
                    type="text"
                    name="title"
                    autoComplete="organization-title"
                    value={values.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    disabled={phase === 'submitting'}
                  />
                </label>
              </div>

              <fieldset className="public-card-connect-fieldset">
                <legend>{copy.reasonLabel}</legend>
                <div className="public-card-connect-reasons" role="radiogroup" aria-label={copy.reasonLabel}>
                  {LETS_CONNECT_REASON_OPTIONS.map((reason) => (
                    <label key={reason} className="public-card-connect-reason">
                      <input
                        type="radio"
                        name="reasonForConnecting"
                        value={reason}
                        checked={values.reasonForConnecting === reason}
                        onChange={() => updateField('reasonForConnecting', reason)}
                        disabled={phase === 'submitting'}
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="public-card-connect-field">
                <span>Note (optional)</span>
                <textarea
                  name="note"
                  rows={3}
                  value={values.note}
                  onChange={(event) => updateField('note', event.target.value)}
                  disabled={phase === 'submitting'}
                />
              </label>

              <label className="public-card-connect-field">
                <span>Preferred follow-up method (optional)</span>
                <select
                  name="preferredFollowUpMethod"
                  value={values.preferredFollowUpMethod}
                  onChange={(event) =>
                    updateField(
                      'preferredFollowUpMethod',
                      event.target.value as LetsConnectFormValues['preferredFollowUpMethod'],
                    )
                  }
                  disabled={phase === 'submitting'}
                >
                  <option value="">No selection</option>
                  {LETS_CONNECT_FOLLOW_UP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="public-card-connect-hint">
                  This is a preference only — it is not consent to be contacted.
                </span>
              </label>

              <fieldset className="public-card-connect-fieldset public-card-connect-consent">
                <legend>Consent</legend>
                <label className="public-card-connect-check">
                  <input
                    type="checkbox"
                    checked={values.consent.privacyAcknowledged}
                    onChange={(event) =>
                      updateField('consent', {
                        ...values.consent,
                        privacyAcknowledged: event.target.checked,
                      })
                    }
                    required
                    disabled={phase === 'submitting'}
                    aria-invalid={Boolean(clientErrors.privacy)}
                  />
                  <span>
                    I acknowledge the{' '}
                    <Link to={ROUTES.privacy} target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>
                    . <span className="public-card-connect-required">Required</span>
                  </span>
                </label>
                {clientErrors.privacy ? (
                  <p className="public-card-connect-field-error" role="alert">
                    {clientErrors.privacy}
                  </p>
                ) : null}
                <label className="public-card-connect-check">
                  <input
                    type="checkbox"
                    checked={values.consent.contactPermission}
                    onChange={(event) =>
                      updateField('consent', {
                        ...values.consent,
                        contactPermission: event.target.checked,
                      })
                    }
                    disabled={phase === 'submitting'}
                  />
                  <span>You may contact me about this conversation (optional)</span>
                </label>
                <label className="public-card-connect-check">
                  <input
                    type="checkbox"
                    checked={values.consent.emailMarketingConsent}
                    onChange={(event) =>
                      updateField('consent', {
                        ...values.consent,
                        emailMarketingConsent: event.target.checked,
                      })
                    }
                    disabled={phase === 'submitting'}
                  />
                  <span>Email me occasional updates (optional)</span>
                </label>
                <label
                  className={`public-card-connect-check${smsDisabled ? ' is-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={values.consent.smsMarketingConsent}
                    onChange={(event) =>
                      updateField('consent', {
                        ...values.consent,
                        smsMarketingConsent: event.target.checked,
                      })
                    }
                    disabled={phase === 'submitting' || smsDisabled}
                  />
                  <span>
                    Text me occasional updates (optional)
                    {smsDisabled ? ' — add a phone number to enable' : ''}
                  </span>
                </label>
              </fieldset>

              {/* Honeypots — visually hidden, must stay empty */}
              <div className="public-card-connect-honeypot" aria-hidden="true">
                <label>
                  Website
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.website}
                    onChange={(event) => updateField('website', event.target.value)}
                  />
                </label>
                <label>
                  Company URL
                  <input
                    type="text"
                    name="companyUrl"
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.companyUrl}
                    onChange={(event) => updateField('companyUrl', event.target.value)}
                  />
                </label>
              </div>

              {submitError ? (
                <p className="public-card-connect-submit-error" role="alert">
                  {submitError}
                </p>
              ) : null}

              <div className="public-card-connect-actions">
                <button
                  type="button"
                  className="platform-btn platform-btn-outline public-card-btn"
                  onClick={onClose}
                  disabled={phase === 'submitting'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="platform-btn platform-btn-primary public-card-btn"
                  disabled={phase === 'submitting'}
                  aria-busy={phase === 'submitting'}
                >
                  {phase === 'submitting' ? 'Saving…' : copy.title}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
