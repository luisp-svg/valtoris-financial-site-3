import type { HouseholdTimelineDisplayVariant, HouseholdTimelineItem } from './types'
import { formatTimelineDateTime } from './activityTabConfig'

type HouseholdTimelineItemViewProps = {
  item: HouseholdTimelineItem
  onEdit?: (item: HouseholdTimelineItem) => void
  onDelete?: (item: HouseholdTimelineItem) => void
  actionsDisabled?: boolean
}

function VariantMark({ variant }: { variant: HouseholdTimelineDisplayVariant }) {
  const label =
    variant === 'note'
      ? 'N'
      : variant === 'assignment'
        ? 'A'
        : variant === 'stage'
          ? 'S'
          : variant === 'recommendation'
            ? 'R'
            : variant === 'task'
              ? 'T'
              : '•'

  return (
    <span
      className={`crm-timeline-variant crm-timeline-variant-${variant}`}
      aria-label={`${variant} activity`}
      title={variant}
    >
      {label}
    </span>
  )
}

export default function HouseholdTimelineItemView({
  item,
  onEdit,
  onDelete,
  actionsDisabled = false,
}: HouseholdTimelineItemViewProps) {
  const showActions = item.isEditable || item.isDeletable

  return (
    <article className="crm-timeline-item">
      <VariantMark variant={item.displayVariant} />
      <div className="crm-timeline-item-body">
        <div className="crm-timeline-item-head">
          <p className="crm-task-title">{item.title}</p>
          {item.isEdited ? <span className="crm-timeline-edited">Edited</span> : null}
        </div>
        <p className="crm-task-meta">
          {item.actorDisplayName ? `${item.actorDisplayName} · ` : null}
          {formatTimelineDateTime(item.occurredAt)}
        </p>
        {item.body ? <p className="crm-household-activity-body">{item.body}</p> : null}
        {showActions ? (
          <div className="crm-timeline-item-actions">
            {item.isEditable && onEdit ? (
              <button
                type="button"
                className="crm-text-btn"
                onClick={() => onEdit(item)}
                disabled={actionsDisabled}
              >
                Edit
              </button>
            ) : null}
            {item.isDeletable && onDelete ? (
              <button
                type="button"
                className="crm-text-btn crm-text-btn-danger"
                onClick={() => onDelete(item)}
                disabled={actionsDisabled}
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}
