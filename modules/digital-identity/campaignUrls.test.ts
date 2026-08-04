import { describe, expect, it } from 'vitest'
import {
  buildCampaignLink,
  buildCampaignQrDestinationPath,
  buildCampaignQrDestinationUrl,
  buildEventLink,
  buildPublicCardPathWithAttribution,
  extractReferrerHost,
  normalizeCampaignAttributionQuery,
  parseCampaignAttributionFromSearch,
} from './campaignUrls'
import { isKeyBasedQrDestination } from './qr'

const KEY = 'pk_live_abcdefghijklmnop'

describe('campaign URL helpers', () => {
  it('builds canonical campaign and event links with public_key only', () => {
    expect(buildCampaignLink(KEY, 'rr-chamber-2026')).toBe(
      `/c/k/${KEY}?c=rr-chamber-2026&src=link`,
    )
    expect(buildEventLink(KEY, 'rr-chamber-2026', 'breakfast-aug-12')).toBe(
      `/c/k/${KEY}?c=rr-chamber-2026&e=breakfast-aug-12&src=link`,
    )
    expect(buildPublicCardPathWithAttribution(KEY, { campaignCode: 'x' })).not.toMatch(
      /^\/c\/[^k]/,
    )
  })

  it('omit empty values and allowlists query params', () => {
    const path = buildPublicCardPathWithAttribution(KEY, {
      campaignCode: 'summit',
      eventCode: '',
      sourceChannel: 'qr',
      utmSource: 'flyer',
      utmMedium: null,
    })
    expect(path).toBe(`/c/k/${KEY}?c=summit&src=qr&utm_source=flyer`)
    expect(path).not.toContain('utm_medium')
    expect(path).not.toMatch(/(?:^|[?&])e=/)
  })

  it('rejects invalid codes and unknown source channels', () => {
    expect(
      normalizeCampaignAttributionQuery({
        campaignCode: 'bad code!',
        sourceChannel: 'email',
      }),
    ).toEqual(
      expect.objectContaining({
        campaignCode: null,
        sourceChannel: null,
      }),
    )
  })

  it('parses search params and clips UTMs', () => {
    const parsed = parseCampaignAttributionFromSearch(
      '?c=summit&e=day1&src=link&utm_source=' + 'a'.repeat(250),
    )
    expect(parsed.campaignCode).toBe('summit')
    expect(parsed.eventCode).toBe('day1')
    expect(parsed.utmSource?.length).toBe(200)
  })

  it('builds public_key-only QR destinations with src=qr', () => {
    const path = buildCampaignQrDestinationPath(KEY, {
      campaignCode: 'summit',
      eventCode: 'day1',
    })
    expect(path).toBe(`/c/k/${KEY}?c=summit&e=day1&src=qr`)
    expect(isKeyBasedQrDestination(path)).toBe(true)
    const absolute = buildCampaignQrDestinationUrl('https://valtoris.example', KEY, {
      campaignCode: 'summit',
    })
    expect(absolute).toBe(`https://valtoris.example/c/k/${KEY}?c=summit&src=qr`)
    expect(isKeyBasedQrDestination(absolute!)).toBe(true)
  })

  it('extracts referrer host only', () => {
    expect(extractReferrerHost('https://news.example/path?q=1')).toBe('news.example')
    expect(extractReferrerHost('news.example/path')).toBe('news.example')
  })
})
