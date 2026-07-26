import type { ReactNode } from 'react'

export type StatCardProps = {
  label: string
  value: ReactNode
  caption?: ReactNode
  empty?: boolean
  className?: string
}

/** Reusable KPI / metric card for CRM surfaces. */
export default function StatCard({
  label,
  value,
  caption,
  empty = false,
  className = '',
}: StatCardProps) {
  return (
    <article className={`crm-stat-card${className ? ` ${className}` : ''}`}>
      <h3 className="crm-stat-card-label">{label}</h3>
      <p className={`crm-stat-card-value${empty ? ' is-empty' : ''}`}>{value}</p>
      {caption ? <p className="crm-stat-card-caption">{caption}</p> : null}
    </article>
  )
}
