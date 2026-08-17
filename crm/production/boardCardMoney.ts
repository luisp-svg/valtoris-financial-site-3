/**
 * Board-card money line. Uses the same annualization helper as the dashboard.
 * Face amount is never added to premium. Compensation is never shown.
 */
import { isFiaProductionLine, isLifeProductionLine } from './dashboardView'
import { annualizeProductionPremium } from './premiumAnnualize'
import type { ProductionApplicationListItem } from './types'

export type ProductionBoardCardMoney =
  | { kind: 'life'; annualPremiumCents: number | null; faceAmountCents: number | null }
  | { kind: 'fia'; depositCents: number | null }
  | { kind: 'other' }

export function productionBoardCardMoney(
  item: Pick<
    ProductionApplicationListItem,
    'product_line' | 'submitted_premium_cents' | 'premium_mode' | 'annuity_deposit_cents' | 'face_amount_cents'
  >,
): ProductionBoardCardMoney {
  if (isFiaProductionLine(item.product_line)) {
    return { kind: 'fia', depositCents: item.annuity_deposit_cents }
  }
  if (isLifeProductionLine(item.product_line)) {
    return {
      kind: 'life',
      annualPremiumCents: annualizeProductionPremium(item.submitted_premium_cents, item.premium_mode),
      faceAmountCents: item.face_amount_cents,
    }
  }
  return { kind: 'other' }
}
