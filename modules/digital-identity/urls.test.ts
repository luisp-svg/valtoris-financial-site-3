import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPublicCardPath, normalizePublicHref, normalizePublicHttpsUrl } from './urls'

const SITE_RELATIVE_ADVISOR_PHOTO = '/images/advisors/luis-perez.png'
const STATIC_ADVISOR_PHOTO = join(process.cwd(), 'public/images/advisors/luis-perez.png')

describe('normalizePublicHref', () => {
  it('accepts the site-relative advisor photo path used as photo_url', () => {
    expect(normalizePublicHref(SITE_RELATIVE_ADVISOR_PHOTO)).toBe(SITE_RELATIVE_ADVISOR_PHOTO)
    expect(existsSync(STATIC_ADVISOR_PHOTO)).toBe(true)
  })

  it('accepts https URLs and other site-relative paths', () => {
    expect(normalizePublicHref('https://cdn.example.com/headshot.jpg')).toBe(
      'https://cdn.example.com/headshot.jpg',
    )
    expect(normalizePublicHref('/images/advisors/example.png')).toBe('/images/advisors/example.png')
  })

  it('rejects unsafe or non-public schemes', () => {
    expect(normalizePublicHref('javascript:alert(1)')).toBeNull()
    expect(normalizePublicHref('data:image/png;base64,abc')).toBeNull()
    expect(normalizePublicHref('http://cdn.example.com/headshot.jpg')).toBeNull()
    expect(normalizePublicHref('//cdn.example.com/headshot.jpg')).toBeNull()
    expect(normalizePublicHref('')).toBeNull()
  })

  it('does not alter permanent public-key routing', () => {
    expect(buildPublicCardPath('pk_live_abcdefghijklmnop')).toBe('/c/k/pk_live_abcdefghijklmnop')
  })
})

describe('normalizePublicHttpsUrl', () => {
  it('accepts safe https booking and social URLs', () => {
    expect(normalizePublicHttpsUrl('https://calendly.com/jane')).toBe('https://calendly.com/jane')
    expect(normalizePublicHttpsUrl('  https://linkedin.com/in/jane  ')).toBe(
      'https://linkedin.com/in/jane',
    )
  })

  it('rejects site-relative paths and unsafe schemes', () => {
    expect(normalizePublicHttpsUrl('/images/advisors/luis-perez.png')).toBeNull()
    expect(normalizePublicHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(normalizePublicHttpsUrl('data:text/html,hi')).toBeNull()
    expect(normalizePublicHttpsUrl('http://calendly.com/jane')).toBeNull()
    expect(normalizePublicHttpsUrl('//calendly.com/jane')).toBeNull()
    expect(normalizePublicHttpsUrl('')).toBeNull()
  })
})
