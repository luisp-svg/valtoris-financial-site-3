import type { CaseNextAction } from './caseNextAction'

type CaseNextActionPanelProps = {
  action: CaseNextAction
}

export default function CaseNextActionPanel({ action }: CaseNextActionPanelProps) {
  const isError = action.kind === 'error'
  const isLoading = action.kind === 'loading'

  return (
    <section className="crm-panel crm-case-next-action" aria-labelledby="pp-next-action-heading">
      <div className="crm-panel-head">
        <h2 id="pp-next-action-heading">Next Action</h2>
      </div>
      {isError ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {action.title}
        </div>
      ) : (
        <p className="crm-case-next-action-title">{action.title}</p>
      )}
      {action.detail ? (
        <p className={isLoading ? 'crm-muted' : 'crm-case-next-action-detail'}>{action.detail}</p>
      ) : null}
      {action.kind === 'none' || action.kind === 'closed' ? (
        <p className="crm-muted">No outstanding requirement or follow-up is recorded for this Case.</p>
      ) : null}
    </section>
  )
}

export function CaseNextActionLine({ action }: { action: CaseNextAction }) {
  const line =
    action.kind === 'none' ||
    action.kind === 'loading' ||
    action.kind === 'not_a_case' ||
    action.kind === 'closed'
      ? null
      : action.detail
        ? `${action.title} · ${action.detail}`
        : action.title
  if (!line) return null
  return (
    <p className="crm-case-next-action-line">
      <span className="crm-case-next-action-kicker">Next</span>
      {line}
    </p>
  )
}
