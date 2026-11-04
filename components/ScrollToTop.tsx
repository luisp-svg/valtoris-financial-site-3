import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Honor anchors even when their page arrives after a lazy route loads. */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }
    let id: string
    try {
      id = decodeURIComponent(hash.slice(1))
    } catch {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }
    const scrollToAnchor = () => {
      const target = id ? document.getElementById(id) : null
      if (!target) return false
      target.scrollIntoView({ behavior: 'instant' })
      return true
    }
    if (scrollToAnchor()) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    const observer = new MutationObserver(() => {
      if (scrollToAnchor()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => observer.disconnect(), 10000)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [pathname, hash])

  return null
}
