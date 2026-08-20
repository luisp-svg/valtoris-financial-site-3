type CaseAttentionFlagListProps = {
  labels: string[]
}

export default function CaseAttentionFlagList({ labels }: CaseAttentionFlagListProps) {
  if (labels.length === 0) return null
  return (
    <ul className="crm-case-attention-flags">
      {labels.map((label) => (
        <li key={label} className="crm-case-flag">
          {label}
        </li>
      ))}
    </ul>
  )
}
