import { describe, expect, it } from 'vitest'
import { annualizeProductionPremium, isAnnualizablePremiumMode } from './premiumAnnualize'

describe('annualizeProductionPremium', () => {
  it('annualizes monthly, quarterly, semi_annual, and annual modes in integer cents', () => {
    expect(annualizeProductionPremium(12915, 'monthly')).toBe(154980)
    expect(annualizeProductionPremium(66155, 'monthly')).toBe(793860)
    expect(annualizeProductionPremium(24074, 'monthly')).toBe(288888)
    expect(annualizeProductionPremium(10000, 'quarterly')).toBe(40000)
    expect(annualizeProductionPremium(10000, 'semi_annual')).toBe(20000)
    expect(annualizeProductionPremium(10000, 'annual')).toBe(10000)
  })

  it('omits single, other, null, and unknown modes instead of inventing an amount', () => {
    expect(annualizeProductionPremium(10000, 'single')).toBeNull()
    expect(annualizeProductionPremium(10000, 'other')).toBeNull()
    expect(annualizeProductionPremium(10000, null)).toBeNull()
    expect(annualizeProductionPremium(10000, 'weekly')).toBeNull()
    expect(annualizeProductionPremium(null, 'monthly')).toBeNull()
    expect(isAnnualizablePremiumMode('monthly')).toBe(true)
    expect(isAnnualizablePremiumMode('single')).toBe(false)
  })
})
