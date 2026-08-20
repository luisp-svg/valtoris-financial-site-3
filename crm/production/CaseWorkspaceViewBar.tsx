import {
  CASE_WORKSPACE_VIEWS,
  caseWorkspaceViewLabel,
  type CaseWorkspaceView,
} from './caseWorkspace'

type CaseWorkspaceViewBarProps = {
  value: CaseWorkspaceView
  onChange: (next: CaseWorkspaceView) => void
  counts: Record<CaseWorkspaceView, number>
  disabled?: boolean
}

export default function CaseWorkspaceViewBar({
  value,
  onChange,
  counts,
  disabled = false,
}: CaseWorkspaceViewBarProps) {
  return (
    <div className="crm-case-view-bar" role="toolbar" aria-label="Case views">
      {CASE_WORKSPACE_VIEWS.map((view) => {
        const active = value === view
        return (
          <button
            key={view}
            type="button"
            className={active ? 'crm-case-view-btn is-active' : 'crm-case-view-btn'}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(view)}
          >
            {caseWorkspaceViewLabel(view)}
            <span className="crm-count-pill">{counts[view]}</span>
          </button>
        )
      })}
    </div>
  )
}
