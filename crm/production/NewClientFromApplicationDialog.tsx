import { useEffect, useId, useRef, useState } from 'react'
import QuickAddContactForm from '../contacts/QuickAddContactForm'
import type { QuickAddCreateResult } from '../contacts/types'
import { saveHouseholdMemberDateOfBirth } from '../households/memberDob'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export type NewClientFromApplicationDialogProps = {
  open: boolean
  onClose: () => void
  onHouseholdReady: (householdId: string) => void
}

export default function NewClientFromApplicationDialog({
  open,
  onClose,
  onHouseholdReady,
}: NewClientFromApplicationDialogProps) {
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [dobNotice, setDobNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setDateOfBirth('')
      setDobNotice(null)
      return
    }
    closeRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function finishWithHousehold(householdId: string, memberId?: string) {
    const dob = dateOfBirth.trim()
    if (dob && memberId) {
      const saved = await saveHouseholdMemberDateOfBirth(
        createSupabaseBrowserClient(),
        memberId,
        householdId,
        dob,
      )
      if (!saved.ok) setDobNotice(saved.message)
    }
    onHouseholdReady(householdId)
    onClose()
  }

  async function handleCreated(result: QuickAddCreateResult) {
    await finishWithHousehold(result.householdId, result.memberId)
  }

  return (
    <div className="crm-intake-dialog-backdrop" role="presentation">
      <div
        className="crm-panel crm-opportunity-form-panel crm-catalog-dialog crm-new-client-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="crm-panel-head">
          <h2 id={headingId}>New client</h2>
          <button ref={closeRef} type="button" className="crm-text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="crm-muted">
          Creates the same household and contact record used elsewhere in CRM. After save, the new
          household is selected on this application.
        </p>
        {dobNotice ? (
          <p className="crm-banner crm-banner-error" role="status">
            {dobNotice}
          </p>
        ) : null}
        <label className="crm-field">
          <span>Date of birth (optional)</span>
          <input
            type="date"
            aria-label="Date of birth"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            autoComplete="off"
          />
        </label>
        <QuickAddContactForm
          embedded
          title={null}
          onCreatedRecord={(result) => void handleCreated(result)}
          onCancel={onClose}
          onOpenExistingHousehold={(householdId) => void finishWithHousehold(householdId)}
        />
      </div>
    </div>
  )
}
