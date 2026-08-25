import { useEffect } from 'react'
import type { ServiceCopy } from './copy'

export function useServiceDocumentMeta(copy: Pick<ServiceCopy, 'metaTitle' | 'metaDescription'>): void {
  useEffect(() => {
    const previousTitle = document.title
    const meta = document.querySelector('meta[name="description"]')
    const previousDescription = meta?.getAttribute('content') ?? ''
    document.title = copy.metaTitle
    meta?.setAttribute('content', copy.metaDescription)
    return () => {
      document.title = previousTitle
      if (meta) meta.setAttribute('content', previousDescription)
    }
  }, [copy.metaDescription, copy.metaTitle])
}
