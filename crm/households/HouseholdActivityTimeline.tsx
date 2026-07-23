import HouseholdTimelineItemView from './HouseholdTimelineItemView'
import type { HouseholdTimelineItem } from './types'

type HouseholdActivityTimelineProps = {
  items: HouseholdTimelineItem[]
  onEditNote: (item: HouseholdTimelineItem) => void
  onDeleteNote: (item: HouseholdTimelineItem) => void
  actionsDisabled?: boolean
}

export default function HouseholdActivityTimeline({
  items,
  onEditNote,
  onDeleteNote,
  actionsDisabled = false,
}: HouseholdActivityTimelineProps) {
  return (
    <ul className="crm-household-activity-list crm-timeline-list">
      {items.map((item) => (
        <li key={item.id}>
          <HouseholdTimelineItemView
            item={item}
            onEdit={item.isEditable ? onEditNote : undefined}
            onDelete={item.isDeletable ? onDeleteNote : undefined}
            actionsDisabled={actionsDisabled}
          />
        </li>
      ))}
    </ul>
  )
}
