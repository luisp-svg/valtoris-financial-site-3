import HouseholdActivityPanel from '../../HouseholdActivityPanel'
import type { ClientWorkspaceActivityHandlers, ClientWorkspaceTabProps } from '../types'

type TimelineTabProps = ClientWorkspaceTabProps & ClientWorkspaceActivityHandlers

export default function TimelineTab({
  workspace,
  householdId,
  authorUserId,
  actionSuccess,
  onRefreshAfterMutation,
  onRefreshAfterFailure,
  onRetryLoad,
}: TimelineTabProps) {
  return (
    <HouseholdActivityPanel
      householdId={householdId}
      authorUserId={authorUserId}
      workspace={workspace}
      actionSuccess={actionSuccess}
      onRefreshAfterMutation={onRefreshAfterMutation}
      onRefreshAfterFailure={onRefreshAfterFailure}
      onRetryLoad={onRetryLoad}
      panelId="crm-client-workspace-tab-timeline-panel"
      labelledBy="crm-client-workspace-tab-timeline"
      heading="Timeline"
    />
  )
}
