/**
 * Household Policy book reads — SELECT only.
 * One household-scoped policies query + at most one batched writing-allocation query.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapHouseholdPolicyCard,
  type HouseholdPolicyCard,
  type HouseholdPolicyRecord,
  type HouseholdPolicyWriter,
} from './householdPoliciesView'

const MEMBER_EMBED = 'id, first_name, last_name'
const ADVISOR_EMBED = 'id, display_name'

const POLICY_BOOK_SELECT = `
  id,
  household_id,
  source_application_id,
  opportunity_id,
  policy_number,
  status,
  carrier,
  policy_type,
  coverage_amount,
  premium,
  payment_frequency,
  effective_date,
  details,
  insured_member_id,
  policy_owner_member_id,
  policy_owner_name,
  servicing_advisor_id,
  terminated_on,
  termination_reason,
  updated_at,
  insured:household_members!insured_member_id ( ${MEMBER_EMBED} ),
  owner_member:household_members!policy_owner_member_id ( ${MEMBER_EMBED} ),
  servicing:advisor_profiles!servicing_advisor_id ( ${ADVISOR_EMBED} )
`

const WRITING_ALLOCATION_SELECT = `
  application_id,
  recipient_type,
  advisor_id,
  allocation_role,
  commission_bps,
  effective_to,
  advisor:advisor_profiles!advisor_id ( ${ADVISOR_EMBED} )
`

type EmbedOne<T> = T | T[] | null

function asSingle<T>(value: EmbedOne<T>): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function memberDisplayName(value: unknown): string | null {
  const row = asRecord(asSingle(value as EmbedOne<Record<string, unknown>>))
  if (!row) return null
  const name = [asString(row.first_name), asString(row.last_name)].filter(Boolean).join(' ').trim()
  return name || null
}

function advisorDisplayName(value: unknown): string | null {
  const row = asRecord(asSingle(value as EmbedOne<Record<string, unknown>>))
  return row ? asString(row.display_name) : null
}

function mapPolicyRecord(row: Record<string, unknown>): HouseholdPolicyRecord | null {
  const id = asId(row.id)
  const householdId = asId(row.household_id)
  const carrier = asString(row.carrier)
  const policyType = asString(row.policy_type)
  const status = asString(row.status)
  if (!id || !householdId || !carrier || !policyType || !status) return null
  const details = asRecord(row.details) ?? {}
  const ownerMember = memberDisplayName(row.owner_member)
  return {
    id,
    householdId,
    sourceApplicationId: asId(row.source_application_id),
    opportunityId: asId(row.opportunity_id),
    policyNumber: asString(row.policy_number),
    status,
    carrier,
    policyType,
    coverageAmount: asNumber(row.coverage_amount),
    premium: asNumber(row.premium),
    paymentFrequency: asString(row.payment_frequency),
    effectiveDate: asString(row.effective_date),
    details,
    insuredName: memberDisplayName(row.insured),
    ownerName: ownerMember || asString(row.policy_owner_name),
    servicingAdvisorName: advisorDisplayName(row.servicing),
    terminatedOn: asString(row.terminated_on),
    terminationReason: asString(row.termination_reason),
  }
}

function mapWriter(row: Record<string, unknown>): { applicationId: string; writer: HouseholdPolicyWriter } | null {
  if (row.effective_to != null) return null
  if (row.allocation_role !== 'writing' || row.recipient_type !== 'advisor') return null
  const applicationId = asId(row.application_id)
  if (!applicationId) return null
  const advisor = asRecord(asSingle(row.advisor as EmbedOne<Record<string, unknown>>))
  return {
    applicationId,
    writer: {
      advisorId: asId(row.advisor_id) ?? asId(advisor?.id),
      displayName: asString(advisor?.display_name) || 'Advisor',
      commissionBps: asNumber(row.commission_bps) ?? 0,
    },
  }
}

export async function fetchWritingAdvisorsByApplicationIds(
  supabase: SupabaseClient,
  applicationIds: readonly string[],
): Promise<Map<string, HouseholdPolicyWriter[]>> {
  const ids = [...new Set(applicationIds.filter((id) => id.trim()))]
  const writers = new Map<string, HouseholdPolicyWriter[]>()
  if (ids.length === 0) return writers
  const { data, error } = await supabase
    .from('policy_agent_allocations')
    .select(WRITING_ALLOCATION_SELECT)
    .in('application_id', ids)
    .eq('allocation_role', 'writing')
    .eq('recipient_type', 'advisor')
    .is('effective_to', null)
  if (error) throw error
  for (const raw of data ?? []) {
    const mapped = mapWriter(raw as Record<string, unknown>)
    if (!mapped) continue
    const list = writers.get(mapped.applicationId) ?? []
    list.push(mapped.writer)
    writers.set(mapped.applicationId, list)
  }
  return writers
}

/**
 * Household Policy book. Does not filter to in_force.
 * Active-protection KPI filtering is intentionally out of this query.
 */
export async function fetchHouseholdPolicyBook(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdPolicyCard[]> {
  if (!householdId.trim()) return []
  const { data, error } = await supabase
    .from('policies')
    .select(POLICY_BOOK_SELECT)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw error

  const records = (data ?? [])
    .map((row) => mapPolicyRecord(row as Record<string, unknown>))
    .filter((row): row is HouseholdPolicyRecord => row != null)

  const sourceIds = records
    .map((row) => row.sourceApplicationId)
    .filter((id): id is string => Boolean(id))
  const writersByApplication = await fetchWritingAdvisorsByApplicationIds(supabase, sourceIds)

  return records.map((policy) =>
    mapHouseholdPolicyCard(
      policy,
      policy.sourceApplicationId ? writersByApplication.get(policy.sourceApplicationId) ?? [] : [],
    ),
  )
}
