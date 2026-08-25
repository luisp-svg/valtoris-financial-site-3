import PublicLink from '../../publicSite/PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { FamilyConsentField, FamilyConsentState } from '../../reportCard/familyIngest/familyConsent'

export type FamilyConsentSectionLabels = {
  heading?: string
  storage?: string
  storageHint?: string
  storageError?: string
  contact?: string
  emailMarketing?: string
  sms?: string
  smsPhoneNote?: string
  privacyBefore?: string
  privacyLink?: string
  privacyAfter?: string
  privacyHint?: string
  privacyError?: string
  disclaimer?: string
  honeypot?: string
}

export type FamilyConsentSectionProps = {
  consent: FamilyConsentState
  phone: string
  showErrors?: boolean
  missing?: ReadonlyArray<'assessmentStorageAcknowledged' | 'privacyAcknowledged'>
  onChange: (field: FamilyConsentField, value: boolean) => void
  honeypotValue: string
  onHoneypotChange: (value: string) => void
  /** Public product name in the intro sentence. */
  productTitle?: string
  /** Stored-result name in the required storage acknowledgment. */
  storageResultName?: string
  intro?: string
  /** Optional localized labels. Defaults keep existing English Family copy. */
  labels?: FamilyConsentSectionLabels
}

/**
 * Explicit consent controls for the Family Report Card final step.
 * Marketing boxes are never prechecked. SMS is disabled without a phone number.
 * Privacy acknowledgment links to the public /privacy route.
 */
export default function FamilyConsentSection({
  consent,
  phone,
  showErrors = false,
  missing = [],
  onChange,
  honeypotValue,
  onHoneypotChange,
  productTitle = 'Family Financial Report Card™',
  storageResultName = 'Initial Financial Diagnostic',
  intro,
  labels = {},
}: FamilyConsentSectionProps) {
  const phonePresent = phone.trim().length > 0
  const storageMissing = showErrors && missing.includes('assessmentStorageAcknowledged')
  const privacyMissing = showErrors && missing.includes('privacyAcknowledged')
  const storageLabel = (labels.storage ??
    'I understand that Valtoris will use the information I provide to calculate and store my {storageResultName} and related results.').replace(
    /\{storageResultName\}/g,
    storageResultName,
  )

  return (
    <section
      className="family-consent-section"
      aria-labelledby="family-consent-heading"
    >
      <h2 className="family-consent-heading" id="family-consent-heading">
        {labels.heading ?? 'Acknowledgments'}
      </h2>
      <p className="family-consent-intro">
        {intro ??
          `Your ${productTitle} provides an Initial Financial Diagnostic based on the information you shared. Required acknowledgments are marked with an asterisk.`}
      </p>

      <div className="assessment-field assessment-consent-field">
        <label className="assessment-consent-label" htmlFor="family-consent-storage">
          <input
            id="family-consent-storage"
            type="checkbox"
            name="assessmentStorageAcknowledged"
            checked={consent.assessmentStorageAcknowledged}
            aria-required="true"
            aria-invalid={storageMissing || undefined}
            aria-describedby={storageMissing ? 'family-consent-storage-error' : 'family-consent-storage-hint'}
            onChange={(event) => onChange('assessmentStorageAcknowledged', event.target.checked)}
          />
          <span className="assessment-consent-text">
            <span className="family-consent-required-mark" aria-hidden="true">
              *
            </span>
            {storageLabel}
          </span>
        </label>
        <p id="family-consent-storage-hint" className="visually-hidden">
          {labels.storageHint ?? 'Required acknowledgment to save and calculate your diagnostic.'}
        </p>
        {storageMissing ? (
          <p id="family-consent-storage-error" className="family-consent-error" role="alert">
            {labels.storageError ??
              'Please acknowledge that your information will be used to calculate and store your diagnostic.'}
          </p>
        ) : null}
      </div>

      <div className="assessment-field assessment-consent-field">
        <label className="assessment-consent-label" htmlFor="family-consent-contact">
          <input
            id="family-consent-contact"
            type="checkbox"
            name="contactPermission"
            checked={consent.contactPermission}
            onChange={(event) => onChange('contactPermission', event.target.checked)}
          />
          <span className="assessment-consent-text">
            {labels.contact ??
              'I give Valtoris permission to contact me about my results and possible next steps.'}
          </span>
        </label>
      </div>

      <div className="assessment-field assessment-consent-field">
        <label className="assessment-consent-label" htmlFor="family-consent-email-marketing">
          <input
            id="family-consent-email-marketing"
            type="checkbox"
            name="emailMarketingConsent"
            checked={consent.emailMarketingConsent}
            onChange={(event) => onChange('emailMarketingConsent', event.target.checked)}
          />
          <span className="assessment-consent-text">
            {labels.emailMarketing ??
              'I agree to receive occasional marketing emails from Valtoris. I can unsubscribe at any time.'}
          </span>
        </label>
      </div>

      <div className="assessment-field assessment-consent-field">
        <label
          className={`assessment-consent-label${phonePresent ? '' : ' is-disabled'}`}
          htmlFor="family-consent-sms-marketing"
        >
          <input
            id="family-consent-sms-marketing"
            type="checkbox"
            name="smsMarketingConsent"
            checked={consent.smsMarketingConsent}
            disabled={!phonePresent}
            aria-disabled={!phonePresent}
            onChange={(event) => onChange('smsMarketingConsent', event.target.checked)}
          />
          <span className="assessment-consent-text">
            {labels.sms ??
              'I agree to receive recurring marketing text messages from Valtoris at the number provided. Consent is not a condition of receiving my report. Message and data rates may apply. Reply STOP to opt out.'}
            {!phonePresent ? (
              <span className="family-consent-sms-note">
                {' '}
                {labels.smsPhoneNote ??
                  'Add a phone number earlier in the assessment to enable this option.'}
              </span>
            ) : null}
          </span>
        </label>
      </div>

      <div className="assessment-field assessment-consent-field">
        <label className="assessment-consent-label" htmlFor="family-consent-privacy">
          <input
            id="family-consent-privacy"
            type="checkbox"
            name="privacyAcknowledged"
            checked={consent.privacyAcknowledged}
            aria-required="true"
            aria-invalid={privacyMissing || undefined}
            aria-describedby={
              privacyMissing ? 'family-consent-privacy-error' : 'family-consent-privacy-hint'
            }
            onChange={(event) => onChange('privacyAcknowledged', event.target.checked)}
          />
          <span className="assessment-consent-text">
            <span className="family-consent-required-mark" aria-hidden="true">
              *
            </span>
            {labels.privacyBefore ?? 'I acknowledge that I have reviewed the'}{' '}
            <PublicLink
              to={ROUTES.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="family-consent-privacy-link"
              onClick={(event) => event.stopPropagation()}
            >
              {labels.privacyLink ?? 'Valtoris Privacy Policy'}
            </PublicLink>
            {labels.privacyAfter ?? '.'}
          </span>
        </label>
        <p id="family-consent-privacy-hint" className="visually-hidden">
          {labels.privacyHint ??
            'Required privacy acknowledgment. Opens the Privacy Policy in a new tab.'}
        </p>
        {privacyMissing ? (
          <p id="family-consent-privacy-error" className="family-consent-error" role="alert">
            {labels.privacyError ??
              'Please review and acknowledge the Privacy Policy before continuing.'}
          </p>
        ) : null}
      </div>

      <p className="family-consent-disclaimer">
        {labels.disclaimer ??
          'Results are educational estimates based on self-reported information. They are not financial, legal, tax, investment, credit, or insurance advice, and they are not a guarantee. An advisor review may reach different conclusions.'}
      </p>

      {/* Honeypot — visually hidden; must stay empty for humans. */}
      <div className="family-consent-honeypot" aria-hidden="true">
        <label htmlFor="family-consent-website">{labels.honeypot ?? 'Company website'}</label>
        <input
          id="family-consent-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypotValue}
          onChange={(event) => onHoneypotChange(event.target.value)}
        />
      </div>
    </section>
  )
}
