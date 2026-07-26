import type { ReactNode } from 'react'
import Panel from './Panel'
import SectionHeader from './SectionHeader'

export type WidgetProps = {
  title: string
  titleId?: string
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
}

/** Overview / dashboard widget shell built on Panel + SectionHeader. */
export default function Widget({
  title,
  titleId,
  meta,
  actions,
  children,
  className = '',
  wide = false,
}: WidgetProps) {
  const headingId = titleId ?? undefined
  return (
    <Panel
      className={`crm-widget${wide ? ' is-wide' : ''}${className ? ` ${className}` : ''}`}
      labelledBy={headingId}
    >
      <SectionHeader title={title} titleId={headingId} meta={meta} actions={actions} />
      {children}
    </Panel>
  )
}
