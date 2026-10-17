import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { readPublicLocale } from './locale'
import { shouldNoIndex, standaloneCanonical } from './routeIndexing'

export default function PublicRouteIndexing() {
  const { pathname, search } = useLocation()
  const locale = readPublicLocale(search)
  useEffect(() => {
    const cleanups: Array<() => void> = []
    if (shouldNoIndex(pathname)) {
      const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
      const meta = existing ?? document.createElement('meta')
      const previous = meta.getAttribute('content')
      meta.name = 'robots'
      meta.content = 'noindex, nofollow'
      if (!existing) document.head.appendChild(meta)
      cleanups.push(() => {
        if (!existing) meta.remove()
        else if (previous === null) meta.removeAttribute('content')
        else meta.content = previous
      })
    }
    const href = standaloneCanonical(pathname, locale)
    if (href) {
      const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      const link = existing ?? document.createElement('link')
      const previous = link.getAttribute('href')
      link.rel = 'canonical'
      link.href = href
      if (!existing) document.head.appendChild(link)
      cleanups.push(() => {
        if (!existing) link.remove()
        else if (previous === null) link.removeAttribute('href')
        else link.setAttribute('href', previous)
      })
    }
    return () => cleanups.forEach(cleanup => cleanup())
  }, [pathname, locale])
  return null
}
