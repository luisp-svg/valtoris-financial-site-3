import type { HouseholdPolicySummary } from '../../../households/types'

export type ProtectionPolicyKind =
  | 'life'
  | 'disability'
  | 'critical_illness'
  | 'long_term_care'
  | 'other'

/**
 * Deterministic policy_type classification from free-text CRM values.
 * Order matters: disability before long-term care (both may include "long-term"),
 * then critical illness, then life.
 */
export function classifyPolicyType(policyType: string): ProtectionPolicyKind {
  const normalized = policyType.trim().toLowerCase()

  if (!normalized) return 'other'

  if (
    /\b(di|disability|std|ltd|short[\s-]?term\s*disability|long[\s-]?term\s*disability|income\s*protection)\b/.test(
      normalized,
    ) ||
    normalized.includes('disability')
  ) {
    return 'disability'
  }

  if (
    /\b(ltc|long[\s-]?term\s*care)\b/.test(normalized) ||
    normalized.includes('long term care')
  ) {
    return 'long_term_care'
  }

  if (
    /\b(ci|critical[\s-]?illness|dread\s*disease|specified\s*disease)\b/.test(normalized) ||
    normalized.includes('critical illness')
  ) {
    return 'critical_illness'
  }

  if (
    /\b(life|term|whole\s*life|universal\s*life|ul|vul|iul|permanent|wl)\b/.test(normalized) ||
    normalized.includes('life insurance')
  ) {
    return 'life'
  }

  return 'other'
}

export function policiesOfKind(
  policies: readonly HouseholdPolicySummary[],
  kind: ProtectionPolicyKind,
): HouseholdPolicySummary[] {
  return policies.filter((policy) => classifyPolicyType(policy.policy_type) === kind)
}

export function sumCoverageAmount(policies: readonly HouseholdPolicySummary[]): number {
  return policies.reduce((sum, policy) => {
    const amount = policy.coverage_amount
    if (amount == null || !Number.isFinite(amount) || amount < 0) return sum
    return sum + amount
  }, 0)
}
