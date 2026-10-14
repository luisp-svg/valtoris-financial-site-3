import HouseholdDocuments from '../../HouseholdDocuments'
import type { ClientWorkspaceTabProps } from '../types'
export default function DocumentsTab({ householdId }: ClientWorkspaceTabProps) {
  return <div id="crm-client-workspace-tab-documents-panel" role="tabpanel" aria-labelledby="crm-client-workspace-tab-documents" className="crm-household-workspace-tab-panel">
    <HouseholdDocuments key={householdId} householdId={householdId} />
  </div>
}
