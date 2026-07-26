import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { ClientWorkspaceTabProps } from '../types'
import { formatWorkspaceDate } from '../format'

export default function DocumentsTab({ workspace }: ClientWorkspaceTabProps) {
  const documents = workspace.recentDocuments

  return (
    <div
      id="crm-client-workspace-tab-documents-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-documents"
      className="crm-household-workspace-tab-panel"
    >
      <Panel labelledBy="crm-documents-heading">
        <SectionHeader
          title="Documents"
          titleId="crm-documents-heading"
          meta={<span className="crm-count-pill">{documents.length}</span>}
        />
        {documents.length === 0 ? (
          <EmptyState
            title="No documents uploaded"
            description="Document upload from the workspace is not enabled in this sprint."
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
      </Panel>
    </div>
  )
}
