import Widget from '../../../components/ui/Widget'
import HowWeMetBlock from '../../../intake/HowWeMetBlock'
import { buildHowWeMetFromActivities } from '../../../intake/howWeMet'
import type { CrmHouseholdWorkspace } from '../../types'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function HowWeMetWidget({ workspace, onNavigateTab }: Props) {
  const activities = workspace.activities.ok ? workspace.activities.value : []
  const hasPhoto = workspace.recentDocuments.some((doc) => doc.doc_type === 'relationship_photo')
  const model = buildHowWeMetFromActivities(activities, {
    cardOwnerName: workspace.household.assigned_advisor?.display_name ?? null,
    hasRelationshipPhoto: hasPhoto,
  })
  if (!model) return null

  return (
    <Widget
      title="How We Met"
      titleId="crm-widget-how-we-met"
      actions={
        <button
          type="button"
          className="crm-text-btn"
          onClick={() => onNavigateTab('timeline')}
        >
          View timeline
        </button>
      }
    >
      <HowWeMetBlock model={model} className="crm-how-we-met-inline" showHeading={false} />
    </Widget>
  )
}
