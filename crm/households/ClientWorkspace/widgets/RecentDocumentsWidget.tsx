import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { CrmHouseholdWorkspace } from '../../types'
import { formatWorkspaceDate } from '../format'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function RecentDocumentsWidget({ workspace, onNavigateTab }: Props) {
  const documents = workspace.recentDocuments

  return (
    <Widget
      title="Recent Documents"
      titleId="crm-widget-recent-documents"
      meta={<span className="crm-count-pill">{documents.length}</span>}
      actions={
        <button type="button" className="crm-text-btn" onClick={() => onNavigateTab('documents')}>
          View documents
        </button>
      }
    >
      {documents.length === 0 ? (
        <EmptyState
          title="No documents uploaded"
          description="Uploaded files for this household will appear here."
          action={
            <button
              type="button"
              className="crm-secondary-btn"
              onClick={() => onNavigateTab('documents')}
            >
              View Documents
            </button>
          }
        />
      ) : (
        <ul className="crm-household-overview-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <p className="crm-task-title">{doc.file_name}</p>
              <p className="crm-task-meta">
                {doc.doc_type.replace(/_/g, ' ')}
                {' · '}
                {formatWorkspaceDate(doc.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}
