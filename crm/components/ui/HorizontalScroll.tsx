import { useEffect, useRef, useState, type KeyboardEventHandler, type ReactNode } from 'react'
import './horizontalScroll.css'

type Props = {
  label: string
  className: string
  busy?: boolean
  role?: 'region' | 'tablist'
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
  children: ReactNode
}

export default function HorizontalScroll({ label, className, busy, role = 'region', onKeyDown, children }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  function updateEdges() {
    const node = viewport.current
    if (!node) return
    const left = node.scrollLeft > 1
    const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 1
    setEdges(previous => previous.left === left && previous.right === right ? previous : { left, right })
  }

  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(node)
    for (const child of node.children) observer.observe(child)
    updateEdges()
    return () => observer.disconnect()
  }, [children])

  function scroll(direction: number) {
    const node = viewport.current
    if (node) node.scrollBy({ left: direction * node.clientWidth, behavior: 'instant' })
  }

  return (
    <div className="tac-horizontal-scroll">
      {(edges.left || edges.right) && (
        <div className="tac-horizontal-scroll-controls" role="group" aria-label={`Scroll ${label}`}>
          <button type="button" className="crm-secondary-btn" disabled={!edges.left} onClick={() => scroll(-1)}>← Scroll left</button>
          <button type="button" className="crm-secondary-btn" disabled={!edges.right} onClick={() => scroll(1)}>Scroll right →</button>
        </div>
      )}
      <div ref={viewport} className={`${className} tac-horizontal-scroll-viewport`} role={role} aria-label={label}
        aria-busy={busy} tabIndex={role === 'region' && (edges.left || edges.right) ? 0 : undefined}
        onScroll={updateEdges} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  )
}
