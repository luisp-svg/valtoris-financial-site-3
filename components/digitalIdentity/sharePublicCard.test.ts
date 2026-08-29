import { describe, expect, it } from 'vitest'
import {
  buildCanonicalSharePath,
  buildCanonicalShareUrl,
  isCanonicalShareUrl,
  isShareCancellation,
  PUBLIC_CARD_SHARE_COPIED_MESSAGE,
  publicCardShareSideEffects,
  sharePublicCard,
  sharePublicCardErrorCopy,
} from './sharePublicCard'

const KEY = 'pk_live_abcdefghijklmnop'
const ORIGIN = 'https://valtoris.example'

describe('sharePublicCard', () => {
  it('builds only the canonical /c/k/{publicKey} path', () => {
    expect(buildCanonicalSharePath(KEY)).toBe(`/c/k/${KEY}`)
    expect(buildCanonicalSharePath(`  ${KEY}  `)).toBe(`/c/k/${KEY}`)
    expect(buildCanonicalSharePath('jane-advisor')).toBeNull()
    expect(buildCanonicalSharePath('not-a-key')).toBeNull()
  })

  it('builds an absolute key URL and never a slug URL', () => {
    const url = buildCanonicalShareUrl(ORIGIN, KEY)
    expect(url).toBe(`${ORIGIN}/c/k/${KEY}`)
    expect(url).toContain('/c/k/')
    expect(url).not.toContain('/c/jane')
    expect(isCanonicalShareUrl(url!)).toBe(true)
    expect(isCanonicalShareUrl('/c/k/pk_live_abcdefghijklmnop')).toBe(true)
    expect(isCanonicalShareUrl('/c/jane-advisor')).toBe(false)
    expect(isCanonicalShareUrl(`${ORIGIN}/c/jane-advisor`)).toBe(false)
  })

  it('does not encode advisor, user, or household identifiers', () => {
    const url = buildCanonicalShareUrl(ORIGIN, KEY)
    expect(url).not.toMatch(/advisorProfileId|advisor_profile_id|userId|user_id|householdId/)
    expect(url).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(new URL(url!).search).toBe('')
  })

  it('uses Web Share with the canonical key URL', async () => {
    const shared: ShareData = { title: '', text: '', url: '' }
    const result = await sharePublicCard(
      { publicKey: KEY, displayName: 'Jane Advisor', origin: ORIGIN },
      {
        canShare: () => true,
        share: async (data) => {
          shared.title = data.title ?? ''
          shared.text = data.text ?? ''
          shared.url = data.url ?? ''
        },
      },
    )
    expect(result).toEqual({ ok: true, method: 'web_share', url: `${ORIGIN}/c/k/${KEY}`, message: null })
    expect(shared.url).toBe(`${ORIGIN}/c/k/${KEY}`)
    expect(shared.url).not.toContain('/c/jane')
    expect(shared.title).toBe('Jane Advisor')
  })

  it('falls back to clipboard with Link copied feedback', async () => {
    let copied = ''
    const result = await sharePublicCard(
      { publicKey: KEY, displayName: 'Jane Advisor', origin: ORIGIN },
      {
        canShare: () => false,
        writeClipboard: async (text) => {
          copied = text
        },
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.method).toBe('clipboard')
      expect(result.message).toBe(PUBLIC_CARD_SHARE_COPIED_MESSAGE)
      expect(result.url).toBe(`${ORIGIN}/c/k/${KEY}`)
    }
    expect(copied).toBe(`${ORIGIN}/c/k/${KEY}`)
    expect(copied).not.toContain('/c/jane-advisor')
  })

  it('treats Web Share cancellation as a safe non-error', async () => {
    const result = await sharePublicCard(
      { publicKey: KEY, displayName: 'Jane Advisor', origin: ORIGIN },
      {
        canShare: () => true,
        share: async () => {
          const error = new Error('Share canceled')
          error.name = 'AbortError'
          throw error
        },
      },
    )
    expect(result).toEqual({
      ok: true,
      method: 'cancelled',
      url: `${ORIGIN}/c/k/${KEY}`,
      message: null,
    })
    expect(isShareCancellation({ name: 'AbortError' })).toBe(true)
    expect(isShareCancellation(new Error('fail'))).toBe(false)
  })

  it('falls back to clipboard when Web Share fails for a non-cancel reason', async () => {
    const result = await sharePublicCard(
      { publicKey: KEY, displayName: 'Jane Advisor', origin: ORIGIN },
      {
        canShare: () => true,
        share: async () => {
          throw new Error('NotAllowedError')
        },
        writeClipboard: async () => undefined,
      },
    )
    expect(result).toEqual({
      ok: true,
      method: 'clipboard',
      url: `${ORIGIN}/c/k/${KEY}`,
      message: PUBLIC_CARD_SHARE_COPIED_MESSAGE,
    })
  })

  it('returns safe copy when both share and clipboard fail', async () => {
    const result = await sharePublicCard(
      { publicKey: KEY, displayName: 'Jane Advisor', origin: ORIGIN },
      {
        canShare: () => false,
        writeClipboard: async () => {
          throw new Error('denied')
        },
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('share_unavailable')
      expect(result.message).toBe(sharePublicCardErrorCopy('share_unavailable'))
    }
  })

  it('rejects invalid keys without generating a new public key', async () => {
    const result = await sharePublicCard({
      publicKey: 'jane-advisor',
      displayName: 'Jane Advisor',
      origin: ORIGIN,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_public_key')
  })

  it('declares no analytics, CRM, or key-rotation side effects', () => {
    expect(publicCardShareSideEffects()).toEqual({
      writesAnalytics: false,
      writesDigitalCardEvents: false,
      createsLead: false,
      createsHousehold: false,
      createsActivity: false,
      createsTask: false,
      createsCase: false,
      rotatesPublicKey: false,
      usesSlugAsCanonical: false,
      importsAdminClient: false,
      usesServiceRole: false,
    })
  })
})
