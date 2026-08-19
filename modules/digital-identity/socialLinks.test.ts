import { describe, expect, it } from 'vitest'
import {
  PUBLIC_SOCIAL_NETWORKS,
  buildConfiguredSocialLinks,
  emptyPublicSocialDrafts,
  mergePublishProfileSocialLinks,
  socialDraftsFromPublishProfile,
} from './socialLinks'

describe('public social link catalog', () => {
  it('uses stable keys and human-readable labels', () => {
    expect(PUBLIC_SOCIAL_NETWORKS.map((network) => network.key)).toEqual([
      'facebook',
      'instagram',
      'linkedin',
      'tiktok',
      'youtube',
      'x',
    ])
    expect(PUBLIC_SOCIAL_NETWORKS.find((network) => network.key === 'x')?.label).toBe('X / Twitter')
  })

  it('saves only configured https links and drops blanks', () => {
    const result = buildConfiguredSocialLinks({
      ...emptyPublicSocialDrafts(),
      linkedin: 'https://linkedin.com/in/jane',
      instagram: '   ',
      facebook: 'https://facebook.com/valtoris',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.links).toEqual([
      { key: 'facebook', label: 'Facebook', url: 'https://facebook.com/valtoris' },
      { key: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/jane' },
    ])
  })

  it('rejects unsafe social URLs before any merge', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'http://x.com', '//x.com', '/relative']) {
      const result = buildConfiguredSocialLinks({
        ...emptyPublicSocialDrafts(),
        youtube: url,
      })
      expect(result.ok).toBe(false)
    }
  })

  it('merges socialLinks without overwriting unrelated publish_profile fields', () => {
    const merged = mergePublishProfileSocialLinks(
      {
        approvedTitle: 'Financial Strategist',
        approvedCompany: 'Valtoris Financial',
        phoneVisible: true,
        emailVisible: false,
        headline: 'Keep me',
        contactVisibility: { phone: true },
        calendlyUrl: 'https://calendly.com/existing-override',
        specialties: ['Retirement'],
      },
      [{ key: 'x', label: 'X / Twitter', url: 'https://x.com/valtoris' }],
    )
    expect(merged.approvedTitle).toBe('Financial Strategist')
    expect(merged.approvedCompany).toBe('Valtoris Financial')
    expect(merged.phoneVisible).toBe(true)
    expect(merged.emailVisible).toBe(false)
    expect(merged.headline).toBe('Keep me')
    expect(merged.contactVisibility).toEqual({ phone: true })
    expect(merged.calendlyUrl).toBe('https://calendly.com/existing-override')
    expect(merged.specialties).toEqual(['Retirement'])
    expect(merged.socialLinks).toEqual([
      { key: 'x', label: 'X / Twitter', url: 'https://x.com/valtoris' },
    ])
    expect(merged).not.toHaveProperty('cta_config')
    expect(merged).not.toHaveProperty('public_key')
  })

  it('reads known social drafts from publish_profile and ignores blanks', () => {
    const drafts = socialDraftsFromPublishProfile({
      socialLinks: [
        { key: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/jane' },
        { key: 'unknown', label: 'Other', url: 'https://example.com' },
        { key: 'facebook', label: 'Facebook', url: '  ' },
      ],
    })
    expect(drafts.linkedin).toBe('https://linkedin.com/in/jane')
    expect(drafts.facebook).toBe('')
    expect(drafts).not.toHaveProperty('unknown')
  })
})
