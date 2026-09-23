import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createIntegrationContactLinkRepository,
  type IntegrationContactLinkAdmin,
} from './contactLinks'

const MEMBER_A = '11111111-1111-4111-8111-111111111111'
const MEMBER_B = '22222222-2222-4222-8222-222222222222'
const LOCATION = 'loc-test'

type Row = {
  provider: string
  location_id: string
  external_contact_id: string
  household_member_id: string
}

function memoryAdmin(rows: Row[]): IntegrationContactLinkAdmin {
  return {
    from(table) {
      if (table !== 'integration_contact_links') throw new Error('unexpected table')
      return {
        select() {
          const filters: Record<string, string> = {}
          const chain = {
            eq(column: string, value: string) {
              filters[column] = value
              return chain
            },
            async maybeSingle() {
              const matches = rows.filter((row) =>
                Object.entries(filters).every(([key, value]) => row[key as keyof Row] === value),
              )
              if (matches.length > 1) return { data: null, error: { code: 'PGRST116' } }
              const match = matches[0]
              return {
                data: match
                  ? {
                      household_member_id: match.household_member_id,
                      external_contact_id: match.external_contact_id,
                    }
                  : null,
                error: null,
              }
            },
          }
          return chain
        },
        async insert(row) {
          const keys = Object.keys(row).sort()
          if (keys.join(',') !== 'external_contact_id,household_member_id,location_id,provider') {
            return { error: { code: 'unexpected_columns' } }
          }
          const memberClash = rows.some(
            (existing) =>
              existing.provider === row.provider &&
              existing.location_id === row.location_id &&
              existing.household_member_id === row.household_member_id,
          )
          const contactClash = rows.some(
            (existing) =>
              existing.provider === row.provider &&
              existing.location_id === row.location_id &&
              existing.external_contact_id === row.external_contact_id,
          )
          if (memberClash || contactClash) return { error: { code: '23505' } }
          rows.push({ ...row })
          return { error: null }
        },
      }
    },
  }
}

describe('createIntegrationContactLinkRepository', () => {
  it('inserts a verified link and treats the same pair as already linked', async () => {
    const rows: Row[] = []
    const links = createIntegrationContactLinkRepository(memoryAdmin(rows))
    const input = {
      provider: 'agentcrm',
      locationId: LOCATION,
      householdMemberId: MEMBER_A,
      externalContactId: 'ext-a',
    }

    expect(await links.saveVerifiedLink(input)).toEqual({ status: 'created' })
    expect(await links.saveVerifiedLink(input)).toEqual({ status: 'already_linked' })
    expect(rows).toEqual([
      {
        provider: 'agentcrm',
        location_id: LOCATION,
        external_contact_id: 'ext-a',
        household_member_id: MEMBER_A,
      },
    ])
    expect(await links.findByMember(input)).toEqual({
      status: 'found',
      link: { householdMemberId: MEMBER_A, externalContactId: 'ext-a' },
    })
  })

  it('does not overwrite a member linked to a different external contact', async () => {
    const rows: Row[] = []
    const links = createIntegrationContactLinkRepository(memoryAdmin(rows))
    const first = {
      provider: 'agentcrm',
      locationId: LOCATION,
      householdMemberId: MEMBER_A,
      externalContactId: 'ext-a',
    }
    expect(await links.saveVerifiedLink(first)).toEqual({ status: 'created' })
    expect(await links.saveVerifiedLink({ ...first, externalContactId: 'ext-b' })).toEqual({ status: 'conflict' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.external_contact_id).toBe('ext-a')
  })

  it('does not overwrite an external contact linked to a different member', async () => {
    const rows: Row[] = []
    const links = createIntegrationContactLinkRepository(memoryAdmin(rows))
    const first = {
      provider: 'agentcrm',
      locationId: LOCATION,
      householdMemberId: MEMBER_A,
      externalContactId: 'ext-a',
    }
    expect(await links.saveVerifiedLink(first)).toEqual({ status: 'created' })
    expect(
      await links.saveVerifiedLink({ ...first, householdMemberId: MEMBER_B }),
    ).toEqual({ status: 'conflict' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.household_member_id).toBe(MEMBER_A)
  })

  it('does not store a row when the insert fails for another reason', async () => {
    const admin: IntegrationContactLinkAdmin = {
      from() {
        return {
          select() {
            throw new Error('select should not run')
          },
          async insert() {
            return { error: { code: '42501' } }
          },
        }
      },
    }
    const links = createIntegrationContactLinkRepository(admin)
    expect(
      await links.saveVerifiedLink({
        provider: 'agentcrm',
        locationId: LOCATION,
        householdMemberId: MEMBER_A,
        externalContactId: 'ext-a',
      }),
    ).toEqual({ status: 'error' })
  })

  it('does not add an update, delete, or identity payload', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/agentcrm/contactLinks.ts'), 'utf8')
    expect(source).not.toMatch(/\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/)
    expect(source).not.toMatch(/method:\s*['"]POST['"]|method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
    expect(source).not.toContain('email')
    expect(source).not.toContain('phone')
  })
})
