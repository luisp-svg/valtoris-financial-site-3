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

export default function NeedsAttentionSection({
  items,
  loading,
  error,
  warning = null,
  onRetry,
}: Props) {
  return (
    <DashboardSection
      title="Needs Attention"
      wide
      loading={loading}
      error={error}
      warning={warning}
      empty={!loading && !error && items.length === 0}
      emptyMessage="You’re clear — nothing needs attention right now."
      onRetry={onRetry}
      className="crm-dashboard-needs-attention"
    >
      <ul className="crm-dashboard-attention-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={item.href} className="crm-dashboard-attention-item">
              <span className="crm-dashboard-attention-kind">{attentionKindLabel(item.kind)}</span>
              <span className="crm-dashboard-attention-title">{item.title}</span>
              <span className="crm-dashboard-attention-sub">{item.subtitle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
