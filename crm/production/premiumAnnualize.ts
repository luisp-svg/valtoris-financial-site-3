/**
 * Canonical life-premium annualization — mirrors Migration 034
 * `pp_recalculate_application_expected_compensation`.
 *
 * monthly × 12, quarterly × 4, semi_annual × 2, annual × 1.
 * single / other / NULL / unknown → unavailable (null). Integer cents only.
 */
export function annualizeProductionPremium(
  submittedPremiumCents: number | null | undefined,
  premiumMode: string | null | undefined,
): number | null {
  if (submittedPremiumCents == null || Number.isNaN(submittedPremiumCents)) return null
  if (premiumMode === 'monthly') return submittedPremiumCents * 12
  if (premiumMode === 'quarterly') return submittedPremiumCents * 4
  if (premiumMode === 'semi_annual') return submittedPremiumCents * 2
  if (premiumMode === 'annual') return submittedPremiumCents
  return null
}

export function isAnnualizablePremiumMode(premiumMode: string | null | undefined): boolean {
  return (
    premiumMode === 'monthly' ||
    premiumMode === 'quarterly' ||
    premiumMode === 'semi_annual' ||
    premiumMode === 'annual'
  )
}
