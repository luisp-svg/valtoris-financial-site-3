import {
  getMemberDisplayName,
  getRelationshipLabel,
} from './householdsApi'
import type { HouseholdMemberSummary } from './types'
import { displayOptional, formatWorkspaceDate } from './ClientWorkspace/format'

function PrimaryContactBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="crm-status-chip" title="Primary contact">
      {compact ? 'Primary' : 'Primary contact'}
    </span>
  )
}

export type HouseholdMembersTableProps = {
  members: HouseholdMemberSummary[]
  showActions?: boolean
  onEdit?: (member: HouseholdMemberSummary) => void
  onDelete?: (member: HouseholdMemberSummary) => void
  dense?: boolean
}

export default function HouseholdMembersTable({
  members,
  showActions = false,
  onEdit,
  onDelete,
  dense = false,
}: HouseholdMembersTableProps) {
  return (
    <>
      <div
        className="crm-household-members-table-wrap"
        role="region"
        aria-label="Household members table"
      >
        <table className={`crm-household-members-table${dense ? ' is-dense' : ''}`}>
          <thead>
            <tr>
              {dense ? (
                <>
                  <th scope="col">Name</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">Primary contact</th>
                </>
              ) : (
                <>
                  <th scope="col">First Name</th>
                  <th scope="col">Last Name</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">Primary Contact</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Date of Birth</th>
                  {showActions ? <th scope="col">Actions</th> : null}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                {dense ? (
                  <>
                    <td>
                      <span className="crm-households-name">
                        {getMemberDisplayName(member)}
                      </span>
                    </td>
                    <td>{getRelationshipLabel(member.relationship)}</td>
                    <td>
                      {member.is_primary_contact ? (
                        <PrimaryContactBadge compact />
                      ) : (
                        <span className="crm-muted">—</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      <span className="crm-households-name">{member.first_name}</span>
                    </td>
                    <td>
                      <span className="crm-households-name">{member.last_name}</span>
                    </td>
                    <td>{getRelationshipLabel(member.relationship)}</td>
                    <td>
                      {member.is_primary_contact ? (
                        <PrimaryContactBadge />
                      ) : (
                        <span className="crm-muted">No</span>
                      )}
                    </td>
                    <td>{displayOptional(member.email)}</td>
                    <td>{displayOptional(member.phone)}</td>
                    <td>{formatWorkspaceDate(member.date_of_birth)}</td>
                    {showActions ? (
                      <td>
                        <div className="crm-member-row-actions">
                          <button
                            type="button"
                            className="crm-text-btn"
                            onClick={() => onEdit?.(member)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="crm-text-btn crm-text-btn-danger"
                            onClick={() => onDelete?.(member)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="crm-household-members-card-list">
        {members.map((member) => (
          <li key={member.id} className="crm-household-members-card">
            {dense ? (
              <>
                <p className="crm-households-name">{getMemberDisplayName(member)}</p>
                <dl className="crm-households-card-meta">
                  <div>
                    <dt>Relationship</dt>
                    <dd>{getRelationshipLabel(member.relationship)}</dd>
                  </div>
                  <div>
                    <dt>Primary</dt>
                    <dd>
                      {member.is_primary_contact ? <PrimaryContactBadge /> : 'No'}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="crm-households-name">{getMemberDisplayName(member)}</p>
                <dl className="crm-households-card-meta crm-household-members-card-meta-full">
                  <div>
                    <dt>First Name</dt>
                    <dd>{member.first_name}</dd>
                  </div>
                  <div>
                    <dt>Last Name</dt>
                    <dd>{member.last_name}</dd>
                  </div>
                  <div>
                    <dt>Relationship</dt>
                    <dd>{getRelationshipLabel(member.relationship)}</dd>
                  </div>
                  <div>
                    <dt>Primary Contact</dt>
                    <dd>
                      {member.is_primary_contact ? <PrimaryContactBadge /> : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{displayOptional(member.email)}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{displayOptional(member.phone)}</dd>
                  </div>
                  <div>
                    <dt>Date of Birth</dt>
                    <dd>{formatWorkspaceDate(member.date_of_birth)}</dd>
                  </div>
                </dl>
                {showActions ? (
                  <div className="crm-member-row-actions">
                    <button
                      type="button"
                      className="crm-text-btn"
                      onClick={() => onEdit?.(member)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="crm-text-btn crm-text-btn-danger"
                      onClick={() => onDelete?.(member)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
