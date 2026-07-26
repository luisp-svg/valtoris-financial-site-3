import { useId } from 'react'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import HouseholdMemberFormPanel from '../../HouseholdMemberFormPanel'
import HouseholdMembersTable from '../../HouseholdMembersTable'
import { getMemberDisplayName } from '../../householdsApi'
import type { ClientWorkspaceMembersHandlers, ClientWorkspaceTabProps } from '../types'

type HouseholdTabProps = ClientWorkspaceTabProps & ClientWorkspaceMembersHandlers

export default function HouseholdTab({
  workspace,
  memberForm,
  deleteConfirm,
  deletingMember,
  deleteError,
  actionSuccess,
  addMemberButtonRef,
  onOpenCreateMember,
  onOpenEditMember,
  onCloseMemberForm,
  onRequestDeleteMember,
  onMemberSaved,
  onMemberSaveFailed,
  onConfirmDeleteMember,
  onCancelDeleteMember,
}: HouseholdTabProps) {
  const deleteHeadingId = useId()
  const members = workspace.household.members
  const hasPrimary = members.some((member) => member.is_primary_contact)

  return (
    <div
      id="crm-client-workspace-tab-household-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-household"
      className="crm-household-workspace-tab-panel"
    >
      {actionSuccess ? <p className="crm-banner crm-banner-success">{actionSuccess}</p> : null}

      {memberForm.open ? (
        <HouseholdMemberFormPanel
          key={memberForm.mode === 'edit' ? `edit-${memberForm.member.id}` : 'create'}
          mode={memberForm.mode}
          householdId={workspace.household.id}
          member={memberForm.mode === 'edit' ? memberForm.member : null}
          defaultPrimary={members.length === 0 || !hasPrimary}
          onCancel={onCloseMemberForm}
          onSaved={() => void onMemberSaved(memberForm.mode)}
          onSaveFailed={() => void onMemberSaveFailed()}
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
                onClick={onCancelDeleteMember}
                disabled={deletingMember}
              >
                Cancel
              </button>
            }
          />
          <p className="crm-muted">
            Soft-delete <strong>{getMemberDisplayName(deleteConfirm)}</strong> from this household?
            This removes them from active lists. Related policies keep their historical member
            references when possible.
          </p>
          {deleteConfirm.is_primary_contact ? (
            <p className="crm-banner crm-banner-warning">
              This member is the primary contact. Deleting them leaves the household with no primary
              contact until you assign another member.
            </p>
          ) : null}
          {deleteError ? (
            <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
              {deleteError}
            </p>
          ) : null}
          <div className="crm-form-actions">
            <button
              type="button"
              className="crm-primary-btn crm-danger-btn"
              onClick={() => void onConfirmDeleteMember()}
              disabled={deletingMember}
            >
              {deletingMember ? 'Deleting…' : 'Confirm delete'}
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel labelledBy="crm-members-tab-heading">
        <SectionHeader
          title="Household"
          titleId="crm-members-tab-heading"
          meta={<span className="crm-count-pill">{members.length}</span>}
          actions={
            !memberForm.open && !deleteConfirm ? (
              <button
                ref={addMemberButtonRef}
                type="button"
                className="crm-primary-btn crm-members-add-btn"
                onClick={onOpenCreateMember}
              >
                + Add Member
              </button>
            ) : null
          }
        />

        {members.length === 0 && !memberForm.open ? (
          <EmptyState
            className="crm-household-members-empty"
            title="No household members yet."
            description="Add the first household member to track contacts and relationships."
            action={
              <button
                ref={addMemberButtonRef}
                type="button"
                className="crm-secondary-btn"
                onClick={onOpenCreateMember}
              >
                + Add Member
              </button>
            }
          />
        ) : members.length > 0 ? (
          <HouseholdMembersTable
            members={members}
            showActions={!memberForm.open && !deleteConfirm}
            onEdit={onOpenEditMember}
            onDelete={onRequestDeleteMember}
          />
        ) : null}
      </Panel>
    </div>
  )
}
