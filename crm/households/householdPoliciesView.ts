/**
 * Household Policy book — UI projection of public.policies rows.
 * Actual Policy = non-deleted policies row. Not a policy_application.
 * Active-protection KPI filtering stays on the household header / Financial Progress path.
 */
import { crmProductionPath } from '../../constants/routes'
import { formatCents, formatProductionDate } from '../production/productionApi'
import { formatProductionProductLineLabel } from '../production/labels'

export type HouseholdPolicyWriter = {
  advisorId: string | null
  displayName: string
  commissionBps: number
}

export type HouseholdPolicyRecord = {
  id: string
  householdId: string
  sourceApplicationId: string | null
  opportunityId: string | null
  policyNumber: string | null
  status: string
  carrier: string
  policyType: string
  coverageAmount: number | null
  premium: number | null
  paymentFrequency: string | null
  effectiveDate: string | null
  details: Record<string, unknown>
  insuredName: string | null
  ownerName: string | null
  servicingAdvisorName: string | null
  terminatedOn: string | null
  terminationReason: string | null
}

export type HouseholdPolicyCard = {
  id: string
  policyNumberDisplay: string
  statusLabel: string
  statusRaw: string
  carrier: string
  product: string
  insuredLine: string | null
  ownerLine: string | null
  effectiveDateLine: string | null
  moneyLines: string[]
  writingAdvisorsLine: string | null
  servicingAdvisorLine: string | null
  terminationLine: string | null
  viewCaseHref: string | null
}

const KNOWN_POLICY_STATUS_LABELS: Record<string, string> = {
  issued: 'Issued',
  in_force: 'In Force',
  canceled: 'Canceled',
  surrendered: 'Surrendered',
}

export function formatHouseholdPolicyStatus(status: string | null | undefined): string {
  const raw = (status ?? '').trim()
  if (!raw) return '—'
  const key = raw.toLowerCase()
  if (KNOWN_POLICY_STATUS_LABELS[key]) return KNOWN_POLICY_STATUS_LABELS[key]
  return raw.replace(/_/g, ' ')
}

export function policyDetailsProductLine(details: Record<string, unknown>): string | null {
  const value = details.product_line
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function isFiaHouseholdPolicy(policy: Pick<HouseholdPolicyRecord, 'policyType' | 'details'>): boolean {
  if (policyDetailsProductLine(policy.details) === 'fia') return true
  const type = policy.policyType.trim().toLowerCase()
  return type === 'fia' || type.includes('annuit')
}

export function annuityDepositCentsFromDetails(details: Record<string, unknown>): number | null {
  const value = details.annuity_deposit_cents
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value)
  return null
}

export function formatHouseholdPolicyWriters(writers: readonly HouseholdPolicyWriter[]): string | null {
  const named = writers
    .map((row) => {
      const name = row.displayName.trim()
      if (!name) return null
      return { name, commissionBps: row.commissionBps }
    })
    .filter((row): row is { name: string; commissionBps: number } => row != null)
  if (named.length === 0) return null
  if (named.length === 1) return named[0].name
  return named
    .map((row) => {
      const percent = row.commissionBps / 100
      const label = Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
      return `${row.name} (${label}%)`
    })
    .join(', ')
}

export function householdPolicyMoneyLines(policy: HouseholdPolicyRecord): string[] {
  const lines: string[] = []
  if (isFiaHouseholdPolicy(policy)) {
    const depositCents = annuityDepositCentsFromDetails(policy.details)
    if (depositCents != null) lines.push(`Deposit ${formatCents(depositCents)}`)
    return lines
  }
  if (policy.coverageAmount != null && Number.isFinite(policy.coverageAmount)) {
    lines.push(`Face ${formatDollarAmount(policy.coverageAmount)}`)
  }
  if (policy.premium != null && Number.isFinite(policy.premium)) {
    lines.push(`Premium ${formatDollarAmount(policy.premium)}`)
  }
  return lines
}

export function mapHouseholdPolicyCard(
  policy: HouseholdPolicyRecord,
  writers: readonly HouseholdPolicyWriter[] = [],
): HouseholdPolicyCard {
  const productName = policy.policyType.trim()
  const slugLike =
    productName === 'life_term' || productName === 'life_permanent' || productName === 'fia'
  const product = slugLike
    ? formatProductionProductLineLabel(productName)
    : productName || '—'

  const insuredLabel = isFiaHouseholdPolicy(policy) ? 'Annuitant' : 'Insured'
  const insuredName = policy.insuredName?.trim() || null
  const ownerName = policy.ownerName?.trim() || null
  const writersLine = policy.sourceApplicationId ? formatHouseholdPolicyWriters(writers) : null
  const servicing = policy.servicingAdvisorName?.trim() || null
  const terminated =
    policy.terminatedOn || policy.terminationReason?.trim()
      ? [
          policy.terminatedOn ? `Terminated ${formatProductionDate(policy.terminatedOn)}` : null,
          policy.terminationReason?.trim() || null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null

  return {
    id: policy.id,
    policyNumberDisplay: policy.policyNumber?.trim() || 'No policy number',
    statusLabel: formatHouseholdPolicyStatus(policy.status),
    statusRaw: policy.status,
    carrier: policy.carrier.trim() || '—',
    product,
    insuredLine: insuredName ? `${insuredLabel}: ${insuredName}` : null,
    ownerLine: ownerName ? `Owner: ${ownerName}` : null,
    effectiveDateLine: policy.effectiveDate
      ? `Effective ${formatProductionDate(policy.effectiveDate)}`
      : null,
    moneyLines: householdPolicyMoneyLines(policy),
    writingAdvisorsLine: writersLine,
    servicingAdvisorLine: servicing ? `Servicing ${servicing}` : null,
    terminationLine: terminated,
    viewCaseHref: policy.sourceApplicationId ? crmProductionPath(policy.sourceApplicationId) : null,
  }
}

function formatDollarAmount(dollars: number): string {
  return formatCents(Math.round(dollars * 100))
}
