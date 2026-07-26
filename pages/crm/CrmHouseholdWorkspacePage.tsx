import { useParams } from 'react-router-dom'
import ClientWorkspace from '../../crm/households/ClientWorkspace'

/**
 * Route entry for the household Client Workspace.
 * Domain UI lives in `crm/households/ClientWorkspace`.
 */
export default function CrmHouseholdWorkspacePage() {
  const { householdId } = useParams<{ householdId: string }>()
  return <ClientWorkspace householdId={householdId} />
}
