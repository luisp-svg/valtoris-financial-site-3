import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ONBOARDING_SECTION_ID,
  ONBOARDING_SECTION_IDS,
  ONBOARDING_SECTIONS,
  getAdjacentOnboardingSection,
  getOrderedOnboardingSections,
  isOnboardingSectionId,
  sectionIdFromSearchParams,
} from './onboardingSections'

describe('onboarding section metadata', () => {
  it('defines a stable ordered list with unique ids', () => {
    const ordered = getOrderedOnboardingSections()
    expect(ordered).toHaveLength(ONBOARDING_SECTION_IDS.length)
    expect(ordered.map((section) => section.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(new Set(ordered.map((section) => section.id)).size).toBe(ordered.length)
    expect(ordered.map((section) => section.id)).toEqual([...ONBOARDING_SECTION_IDS])
  })

  it('labels the review section as Financial Progress Review', () => {
    const review = ONBOARDING_SECTIONS.find((section) => section.id === 'review')
    expect(review?.title).toBe('Financial Progress Review')
  })

  it('validates section query params and falls back for invalid values', () => {
    expect(isOnboardingSectionId('income')).toBe(true)
    expect(isOnboardingSectionId('nope')).toBe(false)

    expect(sectionIdFromSearchParams(new URLSearchParams('section=debts'))).toBe('debts')
    expect(sectionIdFromSearchParams(new URLSearchParams('section=invalid'))).toBe(
      DEFAULT_ONBOARDING_SECTION_ID,
    )
    expect(sectionIdFromSearchParams(new URLSearchParams(), 'goals')).toBe('goals')
  })

  it('resolves previous and next section adjacency from metadata order', () => {
    expect(getAdjacentOnboardingSection('overview', 'previous')).toBeNull()
    expect(getAdjacentOnboardingSection('overview', 'next')).toBe('members')
    expect(getAdjacentOnboardingSection('review', 'next')).toBeNull()
    expect(getAdjacentOnboardingSection('review', 'previous')).toBe('goals')
  })
})
