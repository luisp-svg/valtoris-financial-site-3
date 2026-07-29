import { useId, useRef, useState } from 'react'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import HouseholdMemberFormPanel from '../../HouseholdMemberFormPanel'
import HouseholdMembersTable from '../../HouseholdMembersTable'
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client'
import {
  formatSupabaseError,
  getMemberDisplayName,
  softDeleteHouseholdMember,
} from '../../householdsApi'
import type { CrmHouseholdDetail, HouseholdMemberSummary } from '../../types'
import type { HouseholdOnboardingAnswers, OnboardingMembersAnswers } from '../onboardingFormTypes'
import type { OnboardingSectionConfig } from '../onboardingSections'
import { validateMembersSection } from '../onboardingValidation'
import SectionValidationSummary from './SectionValidationSummary'

type MemberFormState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; member: HouseholdMemberSummary }

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  answers: HouseholdOnboardingAnswers
  readOnly: boolean
  onChangeMembersAnswers: (
    members:
      | OnboardingMembersAnswers
      | ((prev: OnboardingMembersAnswers) => OnboardingMembersAnswers),
  ) => void
  onHouseholdRefresh: () => Promise<void>
}

function ageFromDob(dob: string | null): string {
  if (!dob) return '—'
  const birth = new Date(`${dob}T00:00:00.000Z`)
  if (Number.isNaN(birth.getTime())) return '—'
  const now = new Date()
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const m = now.getUTCMonth() - birth.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1
  return age >= 0 ? String(age) : '—'
}

export default function HouseholdMembersSection({
  section,
  household,
  answers,
  readOnly,
  onChangeMembersAnswers,
  onHouseholdRefresh,
}: Props) {
  const validation = validateMembersSection(answers, { household })
  const [memberForm, setMemberForm] = useState<MemberFormState>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<HouseholdMemberSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const deleteHeadingId = useId()
  const members = household.members
  const hasPrimary = members.some((m) => m.is_primary_contact)

  return (
    <section className="crm-onboarding-section" aria-labelledby={`crm-onboarding-section-${section.id}-title`}>
      <h2 id={`crm-onboarding-section-${section.id}-title`} className="crm-panel-title">
        {section.title}
      </h2>
      <p className="crm-muted">{section.description}</p>
      <SectionValidationSummary result={validation} />

      {actionSuccess ? <p className="crm-banner crm-banner-success">{actionSuccess}</p> : null}

      {!readOnly ? (
        <div className="crm-onboarding-section-actions">
          <button
            ref={addButtonRef}
            type="button"
            className="crm-secondary-btn"
            onClick={() => {
              setDeleteConfirm(null)
              setMemberForm({ open: true, mode: 'create' })
            }}
          >
            + Add member
          </button>
        </div>
      ) : null}

      {memberForm.open && !readOnly ? (
        <HouseholdMemberFormPanel
          key={memberForm.mode === 'edit' ? `edit-${memberForm.member.id}` : 'create'}
          mode={memberForm.mode}
          householdId={household.id}
          member={memberForm.mode === 'edit' ? memberForm.member : null}
          defaultPrimary={members.length === 0 || !hasPrimary}
          onCancel={() => {
            setMemberForm({ open: false })
            queueMicrotask(() => addButtonRef.current?.focus())
          }}
          onSaved={async () => {
            setMemberForm({ open: false })
            setActionSuccess(memberForm.mode === 'edit' ? 'Member updated.' : 'Member added.')
            await onHouseholdRefresh()
          }}
          onSaveFailed={async () => {
            await onHouseholdRefresh()
          }}
        />
      ) : null}

      {deleteConfirm ? (
        <Panel className="crm-member-delete-panel" labelledBy={deleteHeadingId}>
          <SectionHeader
            title="Delete member"
            titleId={deleteHeadingId}
            actions={
              <button
                type="button"
                className="crm-text-btn"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
            }
          />
          <p className="crm-muted">
            Soft-delete <strong>{getMemberDisplayName(deleteConfirm)}</strong> from this household?
          </p>
          {deleteError ? <p className="crm-banner crm-banner-error">{deleteError}</p> : null}
          <button
            type="button"
            className="crm-primary-btn"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true)
              setDeleteError(null)
              try {
                const supabase = createSupabaseBrowserClient()
                await softDeleteHouseholdMember(supabase, deleteConfirm.id, household.id)
                setDeleteConfirm(null)
                setActionSuccess('Member deleted.')
                await onHouseholdRefresh()
              } catch (err) {
                setDeleteError(formatSupabaseError('delete_member', err))
              } finally {
                setDeleting(false)
              }
            }}
          >
            {deleting ? 'Deleting…' : 'Delete member'}
          </button>
        </Panel>
      ) : null}

      {members.length === 0 ? (
        <EmptyState
          title="No household members yet"
          description="Add at least one member to complete this section."
        />
      ) : (
        <>
          <HouseholdMembersTable
            members={members}
            showActions={!readOnly}
            onEdit={
              readOnly
                ? undefined
                : (member) => {
                    setDeleteConfirm(null)
                    setMemberForm({ open: true, mode: 'edit', member })
                  }
            }
            onDelete={
              readOnly
                ? undefined
                : (member) => {
                    setMemberForm({ open: false })
                    setDeleteConfirm(member)
                  }
            }
          />
          <ul className="crm-onboarding-member-ages crm-muted">
            {members.map((member) => (
              <li key={member.id}>
                {getMemberDisplayName(member)} — age {ageFromDob(member.date_of_birth)}
              </li>
            ))}
          </ul>
        </>
      )}

      <label className="crm-field">
        Advisor member notes (optional, intake only)
        <textarea
          disabled={readOnly}
          rows={3}
          value={answers.members.advisorMemberNotes}
          onChange={(e) =>
            onChangeMembersAnswers({ ...answers.members, advisorMemberNotes: e.target.value })
          }
        />
        <span className="crm-field-hint">
          Does not replace CRM member records. Employment status is captured in Income and
          Employment.
        </span>
      </label>
    </section>
  )
}
