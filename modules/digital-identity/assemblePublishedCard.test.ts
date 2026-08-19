import { describe, expect, it } from 'vitest'
import {
  assemblePublishedCardDto,
  normalizePublicCtaItems,
  responseContainsInternalIds,
} from './assemblePublishedCard'
import { LETS_CONNECT_CTA_LABEL } from './constants'
import type { AdvisorProfilePublicSource, DigitalCardPublicSource } from './assemblePublishedCard'

const advisor: AdvisorProfilePublicSource = {
  displayName: 'Jane Advisor',
  email: 'jane@example.com',
  phone: '555-0100',
  photoUrl: 'https://cdn.example.com/jane.jpg',
  bio: 'Advisor bio',
  calendlyUrl: 'https://calendly.com/valtoris/jane',
}

function card(overrides: Partial<DigitalCardPublicSource> = {}): DigitalCardPublicSource {
  return {
    publicKey: 'pk_test_public_key01',
    slug: 'jane-advisor',
    status: 'published',
    themeKey: 'default',
    publishProfile: {},
    ctaConfig: {},
    deletedAt: null,
    ...overrides,
  }
}

describe('assemblePublishedCardDto', () => {
  it('assembles a published card with advisor defaults', () => {
    const dto = assemblePublishedCardDto({
      card: card(),
      advisor,
      advisorIsActive: true,
    })
    expect(dto).not.toBeNull()
    expect(dto?.displayName).toBe('Jane Advisor')
    expect(dto?.phone).toBe('555-0100')
    expect(dto?.email).toBe('jane@example.com')
    expect(dto?.primaryConnectLabel).toBe(LETS_CONNECT_CTA_LABEL)
    expect(dto?.cardUrl).toBe('/c/k/pk_test_public_key01')
    expect(dto?.ctas.some((item) => item.key === 'lets_connect')).toBe(true)
    expect(dto?.ctas.some((item) => item.key === 'credit_assessment')).toBe(false)
    expect(dto?.approvedTitle).toBe('Financial Strategist')
    expect(dto?.approvedCompany).toBe('Valtoris Financial')
    expect(dto?.headshotUrl).toBe('https://cdn.example.com/jane.jpg')
    expect(responseContainsInternalIds(dto)).toBe(false)
  })

  it('remaps stored Financial Advisor to Financial Strategist without changing the public key path', () => {
    const dto = assemblePublishedCardDto({
      card: card({
        publicKey: 'pk_live_abcdefghijklmnop',
        publishProfile: { approvedTitle: 'Financial Advisor', approvedCompany: 'Valtoris Financial' },
      }),
      advisor,
      advisorIsActive: true,
    })
    expect(dto?.approvedTitle).toBe('Financial Strategist')
    expect(dto?.approvedTitle).not.toBe('Financial Advisor')
    expect(dto?.cardUrl).toBe('/c/k/pk_live_abcdefghijklmnop')
    expect(dto?.publicKey).toBe('pk_live_abcdefghijklmnop')
  })

  it('uses initials-ready empty headshot when advisor photo is missing and rejects unsafe photo URLs', () => {
    const withoutPhoto = assemblePublishedCardDto({
      card: card(),
      advisor: { ...advisor, photoUrl: null },
      advisorIsActive: true,
    })
    expect(withoutPhoto?.headshotUrl).toBeNull()

    const unsafe = assemblePublishedCardDto({
      card: card({ publishProfile: { headshotUrl: 'javascript:alert(1)' } }),
      advisor,
      advisorIsActive: true,
    })
    expect(unsafe?.headshotUrl).toBe('https://cdn.example.com/jane.jpg')
  })

  it('passes a site-relative advisor photo_url through as headshotUrl without changing public-key routing', () => {
    const dto = assemblePublishedCardDto({
      card: card({ publicKey: 'pk_live_abcdefghijklmnop' }),
      advisor: { ...advisor, photoUrl: '/images/advisors/luis-perez.png' },
      advisorIsActive: true,
    })
    expect(dto?.headshotUrl).toBe('/images/advisors/luis-perez.png')
    expect(dto?.publicKey).toBe('pk_live_abcdefghijklmnop')
    expect(dto?.cardUrl).toBe('/c/k/pk_live_abcdefghijklmnop')
  })

  it('omits phone from the public DTO when the advisor profile has none', () => {
    const dto = assemblePublishedCardDto({
      card: card(),
      advisor: { ...advisor, phone: null },
      advisorIsActive: true,
    })
    expect(dto?.phone).toBeNull()
    expect(dto?.email).toBe('jane@example.com')
    expect(JSON.stringify(dto)).not.toMatch(/advisorProfileId|userId|role|commission/)
  })

  it('excludes draft, disabled, soft-deleted, and inactive advisors', () => {
    expect(
      assemblePublishedCardDto({
        card: card({ status: 'draft' }),
        advisor,
        advisorIsActive: true,
      }),
    ).toBeNull()
    expect(
      assemblePublishedCardDto({
        card: card({ status: 'disabled' }),
        advisor,
        advisorIsActive: true,
      }),
    ).toBeNull()
    expect(
      assemblePublishedCardDto({
        card: card({ deletedAt: '2026-08-03T00:00:00.000Z' }),
        advisor,
        advisorIsActive: true,
      }),
    ).toBeNull()
    expect(
      assemblePublishedCardDto({
        card: card(),
        advisor,
        advisorIsActive: false,
      }),
    ).toBeNull()
  })

  it('hides phone and email when visibility flags are false', () => {
    const dto = assemblePublishedCardDto({
      card: card({
        publishProfile: { phoneVisible: false, emailVisible: false },
      }),
      advisor,
      advisorIsActive: true,
    })
    expect(dto?.phone).toBeNull()
    expect(dto?.email).toBeNull()
  })

  it('applies publish_profile overrides over advisor profile values', () => {
    const dto = assemblePublishedCardDto({
      card: card({
        publishProfile: {
          approvedTitle: 'Senior Advisor',
          approvedCompany: 'Valtoris Financial',
          headline: 'Hello',
          bio: 'Override bio',
          headshotUrl: 'https://cdn.example.com/override.jpg',
          website: 'https://valtoris.example',
          specialties: ['Retirement', 'Protection'],
          socialLinks: [
            { key: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/jane' },
            { key: 'bad', label: 'Bad', url: 'javascript:alert(1)' },
          ],
        },
      }),
      advisor,
      advisorIsActive: true,
    })
    expect(dto?.approvedTitle).toBe('Senior Advisor')
    expect(dto?.approvedCompany).toBe('Valtoris Financial')
    expect(dto?.bio).toBe('Override bio')
    expect(dto?.headshotUrl).toBe('https://cdn.example.com/override.jpg')
    expect(dto?.website).toBe('https://valtoris.example/')
    expect(dto?.specialties).toEqual(['Retirement', 'Protection'])
    expect(dto?.socialLinks).toHaveLength(1)
    expect(dto?.socialLinks[0]?.url).toContain('linkedin.com')
  })

  it('safely normalizes malformed publish_profile and cta_config', () => {
    const dto = assemblePublishedCardDto({
      card: card({
        publishProfile: 'not-json-object',
        ctaConfig: null,
      }),
      advisor,
      advisorIsActive: true,
    })
    expect(dto?.displayName).toBe('Jane Advisor')
    expect(dto?.primaryConnectLabel).toBe("Let's Connect")
    expect(dto && 'publishProfile' in dto).toBe(false)
    expect(dto && 'ctaConfig' in dto).toBe(false)
  })
})

describe('normalizePublicCtaItems', () => {
  it('keeps Let\'s Connect exact and forces credit assessment disabled', () => {
    const items = normalizePublicCtaItems(
      {
        primaryConnectLabel: 'Share Contact',
        items: [
          { key: 'lets_connect', label: 'Share Contact', enabled: true },
          { key: 'credit_assessment', label: 'Credit', enabled: true, href: '/credit' },
          { key: 'not_a_real_cta', label: 'Nope', enabled: true },
        ],
      },
      'https://calendly.com/valtoris/jane',
    )
    const connect = items.find((item) => item.key === 'lets_connect')
    expect(connect?.label).toBe("Let's Connect")
    expect(items.some((item) => item.key === 'credit_assessment')).toBe(false)
    expect(items.map((item) => item.key)).not.toContain('not_a_real_cta')
  })
})
