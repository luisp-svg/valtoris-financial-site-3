import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { CONTACT_CATEGORY_OPTIONS } from './categoryLabels'
import {
  findManualContactLeadIdByHousehold,
  previewContactDuplicates,
  updateManualContactRecord,
} from './contactsApi'
import DuplicateCollisionModal from './DuplicateCollisionModal'
import { mapQuickAddError } from './errors'
import type { ContactFormField, ContactFormValues, DuplicateMatch } from './types'
import { contactIdentityFingerprint, validateContactForm } from './validation'

export type ContactEditFormProps = {
  leadId: string
  initialValues: ContactFormValues
  onCancel: () => void
  onSaved: (leadId: string) => void
}

type TokenState = {
  token: string
  fingerprint: string
  expiresAt: string | null
}

/** Minimal edit — update_manual_contact only; no assignment/consent/lifecycle. */
export default function ContactEditForm({
  leadId,
  initialValues,
  onCancel,
  onSaved,
}: ContactEditFormProps) {
  const supabase = useRef(createSupabaseBrowserClient()).current
  const firstNameRef = useRef<HTMLInputElement | null>(null)
  const tokenRef = useRef<TokenState | null>(null)
  const submittingRef = useRef(false)
  const formId = useId()

  const [values, setValues] = useState<ContactFormValues>(initialValues)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactFormField, string>>>({})
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [collisionOpen, setCollisionOpen] = useState(false)
  const [collisionMatches, setCollisionMatches] = useState<DuplicateMatch[]>([])
  const [hasRestricted, setHasRestricted] = useState(false)

  useEffect(() => {
    firstNameRef.current?.focus()
  }, [])

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
  }

  function clearToken() {
    tokenRef.current = null
  }

  function fieldError(field: ContactFormField) {
    return fieldErrors[field]
  }

  async function persistUpdate(mode: 'update' | 'update_separate') {
    const result = await updateManualContactRecord(supabase, leadId, values, {
      mode,
      createToken: mode === 'update_separate' ? tokenRef.current?.token ?? null : null,
    })
    if (result.ok === false) {
      setCollisionMatches(result.matches)
      setHasRestricted(result.hasRestrictedCollision)
      setCollisionOpen(true)
      return null
    }
    clearToken()
    setCollisionOpen(false)
    return result.leadId
  }

  async function handleSubmit(event: FormEvent) {
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
    try {
      const fingerprint = contactIdentityFingerprint(values)
      const token = tokenRef.current
      const tokenFresh =
        token &&
        token.fingerprint === fingerprint &&
        (!token.expiresAt || Date.parse(token.expiresAt) > Date.now())

      let savedId: string | null = null
      if (tokenFresh) {
        savedId = await persistUpdate('update_separate')
      } else {
        clearToken()
        const preview = await previewContactDuplicates(supabase, values, 'update', leadId)
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
        savedId = await persistUpdate('update')
      }
      if (!savedId) return
      onSaved(savedId)
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
      const savedId = await persistUpdate('update_separate')
      if (!savedId) {
        clearToken()
        setBannerError('Please review duplicates again.')
        return
      }
      onSaved(savedId)
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
    try {
      const existingLeadId = await findManualContactLeadIdByHousehold(supabase, householdId)
      if (!existingLeadId) {
        setBannerError('That contact is not available as a Manual Contact record.')
        return
      }
      clearToken()
      setCollisionOpen(false)
      onSaved(existingLeadId)
    } catch {
      setBannerError('Unable to open that contact right now.')
    }
  }

  return (
    <div className="crm-contacts-form-wrap">
      {bannerError ? (
        <div className="crm-banner crm-banner-error" role="alert" id={`${formId}-error`}>
          {bannerError}
        </div>
      ) : null}

      <form className="crm-task-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="crm-form-grid">
          <label className="crm-field">
            <span>First name</span>
            <input
              ref={firstNameRef}
              name="first_name"
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
        </div>

        <p className="crm-muted">
          Assignment, consent, and lifecycle are not editable here. Contact an owner for assignment
          changes.
        </p>

        <div className="crm-form-actions">
          <button type="submit" className="crm-primary-btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            className="crm-text-btn"
            disabled={busy}
            onClick={() => {
              clearToken()
              onCancel()
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
