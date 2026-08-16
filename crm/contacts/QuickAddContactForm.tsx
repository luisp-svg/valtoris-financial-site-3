import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { useCrmAuth } from '../auth/CrmAuthContext'
import { CONTACT_CATEGORY_OPTIONS } from './categoryLabels'
import {
  createManualContact,
  findManualContactLeadIdByHousehold,
  listActiveAdvisorsForAssignment,
  previewContactDuplicates,
} from './contactsApi'
import DuplicateCollisionModal from './DuplicateCollisionModal'
import { mapQuickAddError } from './errors'
import type {
  AdvisorOption,
  ContactFormField,
  ContactFormValues,
  DuplicateMatch,
  QuickAddCreateResult,
} from './types'
import { resetFormAfterSaveAndAddAnother } from './formReset'
import {
  contactIdentityFingerprint,
  emptyContactFormValues,
  validateContactForm,
} from './validation'

export type QuickAddContactFormProps = {
  /** Optional heading slot */
  title?: ReactNode
  onCreated?: (leadId: string) => void
  onCreatedRecord?: (result: QuickAddCreateResult) => void
  /** Stay on the current page and reuse the form inside Policy Production. */
  embedded?: boolean
  onCancel?: () => void
  onOpenExistingHousehold?: (householdId: string) => void
}

type TokenState = {
  token: string
  fingerprint: string
  expiresAt: string | null
}

/**
 * Keyboard-first Quick Add Contact form.
 * Duplicate tokens stay in component memory only — never storage/logs.
 */
export default function QuickAddContactForm({
  title,
  onCreated,
  onCreatedRecord,
  embedded = false,
  onCancel,
  onOpenExistingHousehold,
}: QuickAddContactFormProps) {
  const { role } = useCrmAuth()
  const isOwner = role === 'owner'
  const navigate = useNavigate()
  const supabase = useRef(createSupabaseBrowserClient()).current
  const firstNameRef = useRef<HTMLInputElement | null>(null)
  const tokenRef = useRef<TokenState | null>(null)
  const submittingRef = useRef(false)
  const formId = useId()

  const [values, setValues] = useState<ContactFormValues>(emptyContactFormValues)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactFormField, string>>>({})
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [successLeadId, setSuccessLeadId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([])
  const [keepDefaults, setKeepDefaults] = useState(false)
  const [collisionOpen, setCollisionOpen] = useState(false)
  const [collisionMatches, setCollisionMatches] = useState<DuplicateMatch[]>([])
  const [hasRestricted, setHasRestricted] = useState(false)

  useEffect(() => {
    firstNameRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    void listActiveAdvisorsForAssignment(supabase)
      .then((rows) => {
        if (!cancelled) setAdvisors(rows)
      })
      .catch(() => {
        if (!cancelled) setAdvisors([])
      })
    return () => {
      cancelled = true
    }
  }, [isOwner, supabase])

  // Invalidate in-memory token when identity fields change.
  useEffect(() => {
    const fp = contactIdentityFingerprint(values)
    if (tokenRef.current && tokenRef.current.fingerprint !== fp) {
      tokenRef.current = null
      setCollisionOpen(false)
    }
  }, [values])

  useEffect(() => {
    return () => {
      tokenRef.current = null
    }
  }, [])

  function setField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key as ContactFormField]) return prev
      const next = { ...prev }
      delete next[key as ContactFormField]
      return next
    })
    setBannerError(null)
    setSuccessMessage(null)
  }

  function clearToken() {
    tokenRef.current = null
  }

  function resetAfterSaveAndAddAnother() {
    clearToken()
    setCollisionOpen(false)
    setCollisionMatches([])
    setHasRestricted(false)
    setFieldErrors({})
    setBannerError(null)
    setValues((prev) =>
      resetFormAfterSaveAndAddAnother(prev, { keepDefaults, isOwner }),
    )
    queueMicrotask(() => firstNameRef.current?.focus())
  }

  async function persistCreate(mode: 'create' | 'create_separate'): Promise<QuickAddCreateResult | null> {
    const result = await createManualContact(supabase, values, {
      mode,
      createToken: mode === 'create_separate' ? tokenRef.current?.token ?? null : null,
      includeAssignedAdvisor: isOwner,
    })
    if (result.ok === false) {
      setCollisionMatches(result.matches)
      setHasRestricted(result.hasRestrictedCollision)
      setCollisionOpen(true)
      return null
    }
    clearToken()
    setCollisionOpen(false)
    return result
  }

  async function handleSubmit(event: FormEvent, addAnother: boolean) {
    event.preventDefault()
    if (submittingRef.current) return
    const errors = validateContactForm(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setBannerError('Please fix the highlighted fields.')
      return
    }

    submittingRef.current = true
    setBusy(true)
    setBannerError(null)
    setSuccessMessage(null)
    try {
      const fingerprint = contactIdentityFingerprint(values)
      const token = tokenRef.current
      const tokenFresh =
        token &&
        token.fingerprint === fingerprint &&
        (!token.expiresAt || Date.parse(token.expiresAt) > Date.now())

      let created: QuickAddCreateResult | null = null
      if (tokenFresh) {
        created = await persistCreate('create_separate')
      } else {
        clearToken()
        const preview = await previewContactDuplicates(supabase, values, 'create')
        const hasCollision =
          preview.matches.length > 0 || preview.hasRestrictedCollision || Boolean(preview.createToken)
        if (hasCollision && preview.createToken) {
          tokenRef.current = {
            token: preview.createToken,
            fingerprint,
            expiresAt: preview.expiresAt,
          }
          setCollisionMatches(preview.matches)
          setHasRestricted(preview.hasRestrictedCollision)
          setCollisionOpen(true)
          return
        }
        created = await persistCreate('create')
      }

      if (!created) return
      setSuccessLeadId(created.leadId)
      setSuccessMessage('Contact saved.')
      onCreated?.(created.leadId)
      onCreatedRecord?.(created)
      if (addAnother) resetAfterSaveAndAddAnother()
      else if (!embedded) navigate(`/crm/contacts/${created.leadId}`)
    } catch (error) {
      const mapped = mapQuickAddError((error as { cause?: unknown })?.cause ?? error)
      setBannerError(mapped.message)
      if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field!]: mapped.message }))
      if (mapped.code === 'QUICK_ADD:invalid_token') {
        clearToken()
        setCollisionOpen(false)
      }
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  async function handleCreateSeparate() {
    if (submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    try {
      const created = await persistCreate('create_separate')
      if (!created) {
        clearToken()
        setBannerError('Please review duplicates again.')
        return
      }
      setSuccessLeadId(created.leadId)
      setSuccessMessage('Separate contact created.')
      onCreated?.(created.leadId)
      onCreatedRecord?.(created)
      if (!embedded) navigate(`/crm/contacts/${created.leadId}`)
    } catch (error) {
      const mapped = mapQuickAddError((error as { cause?: unknown })?.cause ?? error)
      setBannerError(mapped.message)
      clearToken()
      setCollisionOpen(false)
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  async function handleOpenExisting(householdId: string) {
    if (embedded && onOpenExistingHousehold) {
      clearToken()
      setCollisionOpen(false)
      onOpenExistingHousehold(householdId)
      return
    }
    try {
      const leadId = await findManualContactLeadIdByHousehold(supabase, householdId)
      if (!leadId) {
        setBannerError('That contact is not available as a Manual Contact record.')
        return
      }
      clearToken()
      setCollisionOpen(false)
      navigate(`/crm/contacts/${leadId}`)
    } catch {
      setBannerError('Unable to open that contact right now.')
    }
  }

  function fieldError(field: ContactFormField) {
    return fieldErrors[field]
  }

  return (
    <div className="crm-contacts-form-wrap">
      {title}
      {bannerError ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {bannerError}
        </div>
      ) : null}
      {successMessage && successLeadId && !embedded ? (
        <div className="crm-banner crm-banner-success" role="status">
          {successMessage}{' '}
          <Link to={`/crm/contacts/${successLeadId}`}>View contact</Link>
        </div>
      ) : null}

      <form
        className="crm-task-form"
        onSubmit={(event) => void handleSubmit(event, false)}
        noValidate
        aria-describedby={bannerError ? `${formId}-error` : undefined}
      >
        <div className="crm-form-grid">
          <label className="crm-field">
            <span>First name</span>
            <input
              ref={firstNameRef}
              name="first_name"
              autoComplete="given-name"
              value={values.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              aria-invalid={Boolean(fieldError('first_name'))}
              required
            />
            {fieldError('first_name') ? (
              <span className="crm-field-error">{fieldError('first_name')}</span>
            ) : null}
          </label>
          <label className="crm-field">
            <span>Last name</span>
            <input
              name="last_name"
              autoComplete="family-name"
              value={values.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              aria-invalid={Boolean(fieldError('last_name'))}
              required
            />
            {fieldError('last_name') ? (
              <span className="crm-field-error">{fieldError('last_name')}</span>
            ) : null}
          </label>
          <label className="crm-field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
              aria-invalid={Boolean(fieldError('email'))}
            />
            {fieldError('email') ? <span className="crm-field-error">{fieldError('email')}</span> : null}
          </label>
          <label className="crm-field">
            <span>Mobile phone</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => setField('phone', e.target.value)}
              aria-invalid={Boolean(fieldError('phone'))}
            />
            {fieldError('phone') ? <span className="crm-field-error">{fieldError('phone')}</span> : null}
          </label>
          <label className="crm-field">
            <span>Company</span>
            <input
              name="company"
              value={values.company}
              onChange={(e) => setField('company', e.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Job title</span>
            <input
              name="job_title"
              value={values.job_title}
              onChange={(e) => setField('job_title', e.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Website</span>
            <input
              name="website"
              inputMode="url"
              placeholder="https://"
              value={values.website}
              onChange={(e) => setField('website', e.target.value)}
              aria-invalid={Boolean(fieldError('website'))}
            />
            {fieldError('website') ? (
              <span className="crm-field-error">{fieldError('website')}</span>
            ) : null}
          </label>
          <label className="crm-field">
            <span>Category</span>
            <select
              name="contact_category"
              value={values.contact_category}
              onChange={(e) =>
                setField('contact_category', e.target.value as ContactFormValues['contact_category'])
              }
            >
              {CONTACT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span>City</span>
            <input name="city" value={values.city} onChange={(e) => setField('city', e.target.value)} />
          </label>
          <label className="crm-field">
            <span>State</span>
            <input
              name="state"
              value={values.state}
              onChange={(e) => setField('state', e.target.value)}
            />
          </label>
          <label className="crm-field crm-field-span">
            <span>How we met</span>
            <input
              name="how_we_met"
              value={values.how_we_met}
              onChange={(e) => setField('how_we_met', e.target.value)}
            />
          </label>
          {isOwner ? (
            <label className="crm-field crm-field-span">
              <span>Assigned advisor</span>
              <select
                name="assigned_advisor_id"
                value={values.assigned_advisor_id}
                onChange={(e) => setField('assigned_advisor_id', e.target.value)}
              >
                <option value="">Default (your advisor profile)</option>
                {advisors.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>
                    {advisor.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="crm-muted crm-field-span">Assigned to you</p>
          )}
          <label className="crm-field crm-field-span">
            <span>Private note</span>
            <textarea
              name="note"
              rows={3}
              value={values.note}
              onChange={(e) => setField('note', e.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Follow-up task</span>
            <input
              name="follow_up_task_title"
              value={values.follow_up_task_title}
              onChange={(e) => setField('follow_up_task_title', e.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Follow-up due date</span>
            <input
              name="follow_up_due_date"
              type="date"
              value={values.follow_up_due_date}
              onChange={(e) => setField('follow_up_due_date', e.target.value)}
              aria-invalid={Boolean(fieldError('follow_up_due_date'))}
            />
            {fieldError('follow_up_due_date') ? (
              <span className="crm-field-error">{fieldError('follow_up_due_date')}</span>
            ) : null}
          </label>
        </div>

        <fieldset className="crm-contacts-consent">
          <legend>Consent</legend>
          <p className="crm-muted">
            Receiving a business card is not consent. Only record consent if it was affirmatively
            obtained. No message is sent when consent is recorded.
          </p>
          <label className="crm-checkbox-field">
            <input
              type="checkbox"
              checked={values.consentEnabled}
              onChange={(e) => setField('consentEnabled', e.target.checked)}
            />
            <span>Record explicit consent for this contact</span>
          </label>
          {values.consentEnabled ? (
            <div className="crm-contacts-consent-fields">
              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={values.privacyAcknowledged}
                  onChange={(e) => setField('privacyAcknowledged', e.target.checked)}
                />
                <span>Privacy acknowledged</span>
              </label>
              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={values.contactPermission}
                  onChange={(e) => setField('contactPermission', e.target.checked)}
                />
                <span>Contact permission</span>
              </label>
              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={values.emailMarketingConsent}
                  onChange={(e) => setField('emailMarketingConsent', e.target.checked)}
                />
                <span>Email marketing</span>
              </label>
              <label className="crm-checkbox-field">
                <input
                  type="checkbox"
                  checked={values.smsMarketingConsent}
                  onChange={(e) => setField('smsMarketingConsent', e.target.checked)}
                />
                <span>SMS marketing</span>
              </label>
              <label className="crm-field">
                <span>Evidence description</span>
                <input
                  name="evidenceDescription"
                  value={values.evidenceDescription}
                  onChange={(e) => setField('evidenceDescription', e.target.value)}
                  placeholder="e.g. Verbal consent at networking event"
                />
              </label>
              {fieldError('consent') ? (
                <span className="crm-field-error">{fieldError('consent')}</span>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        {embedded ? null : (
          <label className="crm-checkbox-field">
            <input
              type="checkbox"
              checked={keepDefaults}
              onChange={(e) => setKeepDefaults(e.target.checked)}
            />
            <span>
              Keep entry defaults after Save &amp; Add Another (category / how we met / state
              {isOwner ? ' / advisor' : ''})
            </span>
          </label>
        )}

        <div className="crm-form-actions">
          <button type="submit" className="crm-primary-btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save Contact'}
          </button>
          {embedded ? null : (
            <button
              type="button"
              className="crm-secondary-btn"
              disabled={busy}
              onClick={(event) => void handleSubmit(event as unknown as FormEvent, true)}
            >
              Save &amp; Add Another
            </button>
          )}
          <button
            type="button"
            className="crm-text-btn"
            disabled={busy}
            onClick={() => {
              clearToken()
              if (embedded) onCancel?.()
              else navigate('/crm/contacts')
            }}
          >
            Cancel
          </button>
        </div>
      </form>

      <DuplicateCollisionModal
        open={collisionOpen}
        matches={collisionMatches}
        hasRestrictedCollision={hasRestricted}
        busy={busy}
        onOpenExisting={(householdId) => void handleOpenExisting(householdId)}
        onCreateSeparate={() => void handleCreateSeparate()}
        onCancel={() => {
          clearToken()
          setCollisionOpen(false)
        }}
      />
    </div>
  )
}
