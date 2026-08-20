import {
  PIPELINE_VIEWS,
  pipelineViewLabel,
  type PipelineView,
} from './pipelineView'

type PipelineViewBarProps = {
  value: PipelineView
  onChange: (next: PipelineView) => void
  counts: Record<PipelineView, number>
  disabled?: boolean
}

export default function PipelineViewBar({
  value,
  onChange,
  counts,
  disabled = false,
}: PipelineViewBarProps) {
  return (
    <div className="crm-pipeline-view-bar" role="toolbar" aria-label="Pipeline views">
      {PIPELINE_VIEWS.map((view) => {
        const active = value === view
        return (
          <button
            key={view}
            type="button"
            className={active ? 'crm-pipeline-view-btn is-active' : 'crm-pipeline-view-btn'}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(view)}
          >
            {pipelineViewLabel(view)}
            <span className="crm-count-pill">{counts[view]}</span>
          </button>
        )
      })}
    </div>
  )
}
