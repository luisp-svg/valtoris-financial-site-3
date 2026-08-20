type OpportunityAttentionFlagListProps = {
  labels: string[]
}

export default function OpportunityAttentionFlagList({
  labels,
}: OpportunityAttentionFlagListProps) {
  if (labels.length === 0) return null
  return (
    <ul className="crm-opportunity-attention-flags">
      {labels.map((label) => (
        <li key={label} className="crm-opportunity-attention-flag">
          {label}
        </li>
      ))}
    </ul>
  )
}
