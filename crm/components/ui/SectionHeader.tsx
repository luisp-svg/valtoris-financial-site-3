import type { ReactNode } from 'react'

export type SectionHeaderProps = {
  title: string
  titleId?: string
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Standard panel / section head with optional meta + actions. */
export default function SectionHeader({
  title,
  titleId,
  meta,
  actions,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`crm-panel-head${className ? ` ${className}` : ''}`}>
      <h2 id={titleId}>{title}</h2>
      {meta || actions ? (
        <div className="crm-section-header-aside">
          {meta}
          {actions}
        </div>
      ) : null}
    </div>
  )
}
