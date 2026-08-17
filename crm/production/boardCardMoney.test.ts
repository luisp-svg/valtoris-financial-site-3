import { describe, expect, it } from 'vitest'
import { productionBoardCardMoney } from './boardCardMoney'
import { annualizeProductionPremium } from './premiumAnnualize'

describe('production board card money', () => {
  it('uses the canonical annualization helper for life premium', () => {
    const monthly = productionBoardCardMoney({
      product_line: 'life_term',
      submitted_premium_cents: 12915,
      premium_mode: 'monthly',
      annuity_deposit_cents: null,
      face_amount_cents: 50000000,
    })
    expect(monthly).toEqual({
      kind: 'life',
      annualPremiumCents: annualizeProductionPremium(12915, 'monthly'),
      faceAmountCents: 50000000,
    })
    expect(monthly.kind === 'life' && monthly.annualPremiumCents).toBe(154980)
  })

  it('does not treat raw monthly premium as annual premium', () => {
    const money = productionBoardCardMoney({
      product_line: 'life_permanent',
      submitted_premium_cents: 10000,
      premium_mode: 'monthly',
      annuity_deposit_cents: 999999,
      face_amount_cents: 25000000,
    })
    expect(money).toEqual({
      kind: 'life',
      annualPremiumCents: 120000,
      faceAmountCents: 25000000,
    })
    expect(money.kind === 'life' ? money.annualPremiumCents : null).not.toBe(10000)
  })

  it('displays FIA deposit and never life premium', () => {
    const money = productionBoardCardMoney({
      product_line: 'fia',
      submitted_premium_cents: 10000,
      premium_mode: 'annual',
      annuity_deposit_cents: 25000000,
      face_amount_cents: 25000000,
    })
    expect(money).toEqual({ kind: 'fia', depositCents: 25000000 })
  })

  it('does not add face amount to premium', () => {
    const money = productionBoardCardMoney({
      product_line: 'life_term',
      submitted_premium_cents: 10000,
      premium_mode: 'annual',
      annuity_deposit_cents: null,
      face_amount_cents: 50000000,
    })
    expect(money.kind).toBe('life')
    if (money.kind !== 'life') return
    expect(money.annualPremiumCents).toBe(10000)
    expect(money.faceAmountCents).toBe(50000000)
    expect((money.annualPremiumCents ?? 0) + (money.faceAmountCents ?? 0)).not.toBe(
      money.annualPremiumCents,
    )
  })
})
