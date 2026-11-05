import { Link } from 'react-router-dom'
import DashboardSection from './DashboardSection'
import { attentionKindLabel } from './needsAttention'
import type { AttentionItem } from './types'

type Props = {
  items: AttentionItem[]
  loading: boolean
  error: string | null
  warning?: string | null
  onRetry: () => void
}

function renderAttentionItem(item: AttentionItem) {
  return (
          <li key={item.id}>
            <Link to={item.href} className="crm-dashboard-attention-item">
              <span className="crm-dashboard-attention-kind">{attentionKindLabel(item.kind)}</span>
              <span className="crm-dashboard-attention-title">{item.title}</span>
              <span className="crm-dashboard-attention-sub">{item.subtitle}</span>
              <span className="tac-attention-action">{item.kind === 'overdue_task' || item.kind === 'task_due_today' ? 'Review task' : 'Review next step'} →</span>
            </Link>
          </li>
  )
}

export default function NeedsAttentionSection({
  items,
  loading,
  error,
  warning = null,
  onRetry,
}: Props) {
  return (
    <DashboardSection
      title="Today — what needs attention"
      wide
      loading={loading}
      error={error}
      warning={warning}
      empty={!loading && !error && items.length === 0}
      emptyMessage="No urgent items found in the work you can access. Use the client guide below to plan your next step."
      onRetry={onRetry}
      className="crm-dashboard-needs-attention"
    >
      <ul className="crm-dashboard-attention-list">
        {items.slice(0, 5).map(renderAttentionItem)}
      </ul>
      {items.length > 5 && <details className="tac-dashboard-details"><summary>View remaining attention items ({items.length - 5})</summary>
      <ul className="crm-dashboard-attention-list">
        {items.slice(5).map(renderAttentionItem)}
      </ul>
      </details>}
    </DashboardSection>
  )
}
