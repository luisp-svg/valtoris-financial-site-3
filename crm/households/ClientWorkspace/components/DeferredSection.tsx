import { useState, type ReactNode } from 'react'

/** Mount on first expansion; keep mounted when closed to preserve drafts and loaded records. */
export default function DeferredSection({ title, children }: { title: string; children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  return <details className="tac-household-section" onToggle={event => { if (event.currentTarget.open) setOpened(true) }}>
    <summary>{title}</summary>
    {opened ? children : null}
  </details>
}
