import { householdMemberFamilyMeta, sortHouseholdMembersForFamilyView } from './familyView'
import { getMemberDisplayName } from './householdsApi'
import { formatMemberAge } from './memberDob'
import type { HouseholdMemberSummary } from './types'
import { displayOptional, formatWorkspaceDate } from './ClientWorkspace/format'

type HouseholdFamilyListProps = {
  members: readonly HouseholdMemberSummary[]
  showContact?: boolean
}

export default function HouseholdFamilyList({
  members,
  showContact = false,
}: HouseholdFamilyListProps) {
  const sorted = sortHouseholdMembersForFamilyView(members)

  if (sorted.length === 0) return null

  return (
    <ul className="crm-household-family-list">
      {sorted.map((member) => {
        const age = formatMemberAge(member.date_of_birth)
        return (
          <li key={member.id} className="crm-household-family-item">
            <p className="crm-task-title">{getMemberDisplayName(member)}</p>
            <p className="crm-task-meta">
              {householdMemberFamilyMeta(member)}
              {member.date_of_birth ? ` · Born ${formatWorkspaceDate(member.date_of_birth)}` : ''}
              {age ? ` · Age ${age}` : ''}
            </p>
            {showContact ? (
              <p className="crm-task-meta">
                {displayOptional(member.email)}
                {member.phone ? ` · ${member.phone}` : ''}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
