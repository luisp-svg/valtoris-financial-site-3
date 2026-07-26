import type { ReactNode } from 'react'

export type PanelProps = {
  children: ReactNode
  className?: string
  labelledBy?: string
}

/** Generic CRM panel container (`.crm-panel`). */
export default function Panel({ children, className = '', labelledBy }: PanelProps) {
  return (
    <section
      className={`crm-panel${className ? ` ${className}` : ''}`}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  )
}
