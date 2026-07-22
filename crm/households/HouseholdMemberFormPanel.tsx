import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  createHouseholdMember,
  formatSupabaseError,
  getRelationshipSelectOptions,
  updateHouseholdMember,
} from './householdsApi'
import { isValidEmailFormat } from './normalizeContact'
import type { HouseholdMemberSummary, MemberRelationship } from './types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export type MemberFormMode = 'create' | 'edit'

export type HouseholdMemberFormValues = {
  first_name: string
  last_name: string
  relationship: MemberRelationship
  date_of_birth: string
  email: string
  phone: string
  is_primary_contact: boolean
}

type HouseholdMemberFormPanelProps = {
  mode: MemberFormMode
  householdId: string
  /** When editing, the current member. */
  member?: HouseholdMemberSummary | null
  /** Default primary checkbox for create (e.g. first member). */
  defaultPrimary?: boolean
  onCancel: () => void
  onSaved: (member: HouseholdMemberSummary) => void
  /** Called after a failed save so the parent can reload authoritative DB state. */
  onSaveFailed?: (error: unknown) => void | Promise<void>
}

const EMPTY_VALUES: HouseholdMemberFormValues = {
  first_name: '',
  last_name: '',
  relationship: 'primary',
  date_of_birth: '',
  email: '',
  phone: '',
  is_primary_contact: false,
}

function valuesFromMember(member: HouseholdMemberSummary): HouseholdMemberFormValues {
  return {
    first_name: member.first_name,
    last_name: member.last_name,
    relationship: member.relationship,
    date_of_birth: member.date_of_birth ?? '',
    email: member.email ?? '',
    phone: member.phone ?? '',
    is_primary_contact: member.is_primary_contact,
  }
}

export default function HouseholdMemberFormPanel({
  mode,
  householdId,
  member = null,
  defaultPrimary = false,
  onCancel,
  onSaved,
  onSaveFailed,
}: HouseholdMemberFormPanelProps) {
  const headingId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<HouseholdMemberFormValues>(() => {
    if (mode === 'edit' && member) return valuesFromMember(member)
    return { ...EMPTY_VALUES, is_primary_contact: defaultPrimary, relationship: 'primary' }
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof HouseholdMemberFormValues, string>>>(
    {},
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const relationshipOptions = getRelationshipSelectOptions(
    mode === 'edit' ? member?.relationship : null,
  )

  function validate(): boolean {
    const next: Partial<Record<keyof HouseholdMemberFormValues, string>> = {}
    if (!form.first_name.trim()) next.first_name = 'First name is required.'
    if (!form.last_name.trim()) next.last_name = 'Last name is required.'
    if (!form.relationship) next.relationship = 'Relationship is required.'
    if (form.email.trim() && !isValidEmailFormat(form.email)) {
      next.email = 'Enter a valid email address.'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        relationship: form.relationship,
        is_primary_contact: form.is_primary_contact,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        date_of_birth: form.date_of_birth.trim() || null,
      }

      const saved =
        mode === 'edit' && member
          ? await updateHouseholdMember(supabase, member.id, householdId, payload)
          : await createHouseholdMember(supabase, {
              household_id: householdId,
              ...payload,
            })

      onSaved(saved)
    } catch (err) {
      setSubmitError(formatSupabaseError(mode === 'edit' ? 'update_member' : 'create_member', err))
      try {
        await onSaveFailed?.(err)
      } catch (reloadError) {
        if (import.meta.env.DEV) {
          console.error(
            '[crm/households/members]',
            formatSupabaseError('reload_after_failed_save', reloadError),
          )
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className="crm-panel crm-member-form-panel"
      aria-labelledby={headingId}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>{mode === 'edit' ? 'Edit Member' : 'Add Member'}</h2>
        <button
          type="button"
          className="crm-text-btn"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>

      {submitError ? (
        <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
          {submitError}
        </p>
      ) : null}

      <form className="crm-task-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="crm-form-grid crm-member-form-grid">
          <label className="crm-field">
            First Name
            <input
              ref={firstFieldRef}
              value={form.first_name}
              onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
              required
              maxLength={100}
              autoComplete="given-name"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.first_name)}
            />
            {fieldErrors.first_name ? (
              <span className="crm-field-error">{fieldErrors.first_name}</span>
            ) : null}
          </label>

          <label className="crm-field">
            Last Name
            <input
              value={form.last_name}
              onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
              required
              maxLength={100}
              autoComplete="family-name"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.last_name)}
            />
            {fieldErrors.last_name ? (
              <span className="crm-field-error">{fieldErrors.last_name}</span>
            ) : null}
          </label>

          <label className="crm-field">
            Relationship
            <select
              value={form.relationship}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  relationship: e.target.value as MemberRelationship,
                }))
              }
              required
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.relationship)}
            >
              {relationshipOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.relationship ? (
              <span className="crm-field-error">{fieldErrors.relationship}</span>
            ) : null}
          </label>
        </div>

        <div className="crm-form-grid crm-member-form-grid">
          <label className="crm-field">
            Date of Birth
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))}
              disabled={submitting}
            />
          </label>

          <label className="crm-field">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              autoComplete="email"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? <span className="crm-field-error">{fieldErrors.email}</span> : null}
          </label>

          <label className="crm-field">
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              autoComplete="tel"
              disabled={submitting}
            />
          </label>
        </div>

        <label className="crm-checkbox-field">
          <input
            type="checkbox"
            checked={form.is_primary_contact}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, is_primary_contact: e.target.checked }))
            }
            disabled={submitting}
          />
          <span>Primary Contact</span>
        </label>

        <div className="crm-form-actions">
          <button type="submit" className="crm-primary-btn" disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add member'}
          </button>
        </div>
      </form>
    </section>
  )
}
