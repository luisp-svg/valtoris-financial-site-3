import type { ReactNode } from 'react'

export type WidgetGridProps = {
  children: ReactNode
  className?: string
  columns?: 1 | 2
}

/** Layout grid for overview widgets — keeps pages from hardcoding section layout. */
export default function WidgetGrid({
  children,
  className = '',
  columns = 2,
}: WidgetGridProps) {
  return (
    <div
      className={`crm-widget-grid crm-widget-grid-${columns}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}
