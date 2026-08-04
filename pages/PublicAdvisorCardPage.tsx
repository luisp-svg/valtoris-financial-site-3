import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PublicAdvisorCardView from '../components/digitalIdentity/PublicAdvisorCardView'
import { fetchPublicCard } from '../components/digitalIdentity/fetchPublicCard'
import {
  documentTitleForCard,
  mapFetchFailureToStatus,
  type PublicCardPageStatus,
} from '../components/digitalIdentity/publicCardViewModel'
import type { IdentitySurfacePublicDto } from '../modules/digital-identity'

type PageState =
  | { status: 'loading'; card: null }
  | { status: 'ready'; card: IdentitySurfacePublicDto }
  | {
      status: Exclude<PublicCardPageStatus, 'loading' | 'ready'>
      card: null
    }

/**
 * Public Digital Advisor Card — presentation only.
 * Consumes GET /api/digital-identity/card. No CRM, analytics, vCard, or Let’s Connect form.
 */
export default function PublicAdvisorCardPage() {
  const params = useParams<{ key?: string; slug?: string }>()
  const key = params.key?.trim() || ''
  const slug = params.slug?.trim() || ''
  const [state, setState] = useState<PageState>({ status: 'loading', card: null })

  useEffect(() => {
    const previousTitle = document.title
    document.title = documentTitleForCard(null)

    if ((key && slug) || (!key && !slug)) {
      setState({ status: 'invalid_request', card: null })
      return () => {
        document.title = previousTitle
      }
    }

    const controller = new AbortController()
    setState({ status: 'loading', card: null })

    void (async () => {
      const result = await fetchPublicCard(
        key ? { key } : { slug },
        { signal: controller.signal },
      )

      if (controller.signal.aborted) return

      if (result.ok) {
        document.title = documentTitleForCard(result.card)
        setState({ status: 'ready', card: result.card })
        return
      }

      // Ignore abort-driven timeouts after unmount/navigation.
      if (result.code === 'timeout' && controller.signal.aborted) return

      setState({
        status: mapFetchFailureToStatus(result.code),
        card: null,
      })
    })()

    return () => {
      controller.abort()
      document.title = previousTitle
    }
  }, [key, slug])

  if (state.status === 'ready') {
    return <PublicAdvisorCardView status="ready" card={state.card} />
  }

  return <PublicAdvisorCardView status={state.status} />
}
