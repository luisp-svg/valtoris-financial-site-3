import type { ReactNode } from 'react'

export type EmptyStateProps = {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
  align?: 'start' | 'center'
}

/** Shared empty-state block for lists, widgets, and tabs. */
export default function EmptyState({
  title,
  description,
  action,
  icon,
  className = '',
  align = 'start',
}: EmptyStateProps) {
  return (
    <div
      className={`crm-empty-state${align === 'center' ? ' is-centered' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      {icon}
      <p className="crm-empty-state-title">{title}</p>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}
