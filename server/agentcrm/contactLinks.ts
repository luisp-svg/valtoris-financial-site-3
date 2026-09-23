export const AGENTCRM_LINK_PROVIDER = 'agentcrm'

const TABLE = 'integration_contact_links'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type IntegrationContactLink = {
  householdMemberId: string
  externalContactId: string
}

export type FindIntegrationContactLinkResult =
  | { status: 'found'; link: IntegrationContactLink }
  | { status: 'not_found' }
  | { status: 'error' }

export type SaveIntegrationContactLinkResult =
  | { status: 'created' }
  | { status: 'already_linked' }
  | { status: 'conflict' }
  | { status: 'error' }

type LinkIdentity = {
  provider: string
  locationId: string
  householdMemberId: string
}

type VerifiedLinkInsert = LinkIdentity & {
  externalContactId: string
}

type LinkRow = {
  household_member_id?: string
  external_contact_id?: string
}

type PostgrestErrorLike = { code?: string } | null

type FilterBuilder = {
  eq: (column: string, value: string) => FilterBuilder
  maybeSingle: () => PromiseLike<{ data: LinkRow | null; error: PostgrestErrorLike }>
}

export type IntegrationContactLinkAdmin = {
  from: (table: string) => {
    select: (columns: string) => FilterBuilder
    insert: (row: {
      provider: string
      location_id: string
      external_contact_id: string
      household_member_id: string
    }) => PromiseLike<{ error: PostgrestErrorLike }>
  }
}

export type IntegrationContactLinkRepository = {
  findByMember: (input: LinkIdentity) => Promise<FindIntegrationContactLinkResult>
  saveVerifiedLink: (input: VerifiedLinkInsert) => Promise<SaveIntegrationContactLinkResult>
}

function boundedText(value: string, max: number): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function linkIdentity(input: LinkIdentity): LinkIdentity | null {
  const provider = boundedText(input.provider, 64)
  const locationId = boundedText(input.locationId, 128)
  const householdMemberId = boundedText(input.householdMemberId, 36)
  if (!provider || !locationId || !householdMemberId || !UUID_PATTERN.test(householdMemberId)) return null
  return { provider, locationId, householdMemberId }
}

function rowLink(data: LinkRow | null): IntegrationContactLink | null {
  const householdMemberId = typeof data?.household_member_id === 'string' ? data.household_member_id : ''
  const externalContactId = typeof data?.external_contact_id === 'string' ? data.external_contact_id : ''
  if (!householdMemberId || !externalContactId) return null
  return { householdMemberId, externalContactId }
}

async function findRow(
  admin: IntegrationContactLinkAdmin,
  column: 'household_member_id' | 'external_contact_id',
  input: LinkIdentity & { value: string },
): Promise<FindIntegrationContactLinkResult> {
  try {
    const { data, error } = await admin
      .from(TABLE)
      .select('household_member_id, external_contact_id')
      .eq('provider', input.provider)
      .eq('location_id', input.locationId)
      .eq(column, input.value)
      .maybeSingle()
    if (error) return { status: 'error' }
    const link = rowLink(data)
    return link ? { status: 'found', link } : { status: 'not_found' }
  } catch {
    return { status: 'error' }
  }
}

/**
 * Service-role repository for one verified member-to-contact relationship.
 * Stores only the four link columns. Never updates or deletes a row.
 */
export function createIntegrationContactLinkRepository(
  admin: IntegrationContactLinkAdmin,
): IntegrationContactLinkRepository {
  return {
    async findByMember(input) {
      const identity = linkIdentity(input)
      if (!identity) return { status: 'error' }
      return findRow(admin, 'household_member_id', { ...identity, value: identity.householdMemberId })
    },

    async saveVerifiedLink(input) {
      const identity = linkIdentity(input)
      const externalContactId = boundedText(input.externalContactId, 128)
      if (!identity || !externalContactId) return { status: 'error' }

      try {
        const { error } = await admin.from(TABLE).insert({
          provider: identity.provider,
          location_id: identity.locationId,
          external_contact_id: externalContactId,
          household_member_id: identity.householdMemberId,
        })
        if (!error) return { status: 'created' }
        if (error.code !== '23505') return { status: 'error' }
      } catch {
        return { status: 'error' }
      }

      const byMember = await findRow(admin, 'household_member_id', {
        ...identity,
        value: identity.householdMemberId,
      })
      if (byMember.status === 'error') return { status: 'error' }
      if (byMember.status === 'found') {
        return byMember.link.externalContactId === externalContactId
          ? { status: 'already_linked' }
          : { status: 'conflict' }
      }

      const byContact = await findRow(admin, 'external_contact_id', {
        ...identity,
        value: externalContactId,
      })
      if (byContact.status === 'error') return { status: 'error' }
      if (byContact.status === 'found') return { status: 'conflict' }
      return { status: 'conflict' }
    },
  }
}
