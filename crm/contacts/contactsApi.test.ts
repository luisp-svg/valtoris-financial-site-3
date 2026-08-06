import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createManualContact,
  fetchManualContacts,
  MANUAL_CONTACT_HOUSEHOLD_EXCLUSION,
  previewContactDuplicates,
  updateManualContactRecord,
} from './contactsApi'
import { emptyContactFormValues } from './validation'

function createQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const query: Record<string, unknown> = {}
  const self = new Proxy(query, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self)
      }
      return target[prop as string]
    },
  })
  return self
}

const leadRow = {
  id: 'lead-1',
  lead_type: 'Manual Contact',
  contact_category: 'potential_client',
  how_we_met: 'Mixer',
  submitted_at: '2026-08-01T00:00:00.000Z',
  created_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
  household: {
    id: 'hh-1',
    display_name: 'Alex Rivera',
    status: 'lead',
    lead_source: 'manual_contact',
    primary_email: 'alex@example.com',
    primary_phone: '5551234567',
    city: 'Austin',
    state: 'TX',
    assigned_advisor_id: 'adv-a',
    created_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    merged_into_household_id: null,
    assigned_advisor: { id: 'adv-a', display_name: 'Advisor A' },
    members: [
      {
        id: 'mem-1',
        first_name: 'Alex',
        last_name: 'Rivera',
        email: 'alex@example.com',
        phone: '5551234567',
        company: 'Acme',
        job_title: 'VP',
        website: 'https://acme.example',
        is_primary_contact: true,
        deleted_at: null,
      },
    ],
  },
}

describe('fetchManualContacts', () => {
  it('queries Manual Contact leads under RLS and filters search/advisor', async () => {
    const leadsQuery = createQuery({ data: [leadRow], error: null, count: 1 })
    const tasksQuery = createQuery({ data: [], error: null })
    const from = vi.fn((table: string) => (table === 'leads' ? leadsQuery : tasksQuery))
    const result = await fetchManualContacts({ from } as unknown as SupabaseClient, {
      search: 'alex',
      category: 'all',
      assignedAdvisorId: 'adv-a',
      page: 1,
      pageSize: 25,
    })
    expect(leadsQuery.eq).toHaveBeenCalledWith('lead_type', 'Manual Contact')
    expect(leadsQuery.is).toHaveBeenCalledWith('deleted_at', null)
    expect(leadsQuery.limit).toHaveBeenCalledWith(500)
    expect(leadsQuery.order).toHaveBeenCalledWith('id', { ascending: false })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].fullName).toBe('Alex Rivera')
    expect(result.fetchCapped).toBe(false)
    expect(result.fetchedCount).toBe(1)
    expect(JSON.stringify(result.items)).not.toMatch(/consent_snapshot|create_token/)
  })

  it('isolates advisor filter so other advisors are excluded client-side', async () => {
    const leadsQuery = createQuery({ data: [leadRow], error: null, count: 1 })
    const from = vi.fn(() => leadsQuery)
    const result = await fetchManualContacts({ from } as unknown as SupabaseClient, {
      search: '',
      category: 'all',
      assignedAdvisorId: 'adv-b',
      page: 1,
      pageSize: 25,
    })
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

describe('RPC helpers', () => {
  it('preview/create/update go through centralized payloads and never send consentedAt', async () => {
    const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
      if (name === 'preview_quick_add_contact_duplicates') {
        return {
          data: {
            ok: true,
            operation: 'create',
            matches: [],
            has_restricted_collision: false,
            create_token: null,
            expires_at: null,
          },
          error: null,
        }
      }
      if (name === 'quick_add_contact') {
        return {
          data: {
            ok: true,
            mode: 'create',
            lead_id: 'l1',
            household_id: 'h1',
            member_id: 'm1',
            note_id: null,
            task_id: null,
          },
          error: null,
        }
      }
      return {
        data: {
          ok: true,
          mode: 'update',
          lead_id: 'l1',
          household_id: 'h1',
          member_id: 'm1',
        },
        error: null,
      }
    })
    const values = {
      ...emptyContactFormValues(),
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'a@x.com',
      contact_category: 'other' as const,
      consentEnabled: true,
      privacyAcknowledged: true,
      contactPermission: true,
      evidenceDescription: 'yes',
    }
    await previewContactDuplicates({ rpc } as unknown as SupabaseClient, values, 'create')
    await createManualContact({ rpc } as unknown as SupabaseClient, values, {
      mode: 'create',
      includeAssignedAdvisor: false,
    })
    await updateManualContactRecord({ rpc } as unknown as SupabaseClient, 'l1', values)
    for (const call of rpc.mock.calls as Array<[string, Record<string, unknown>]>) {
      const payload = call[1]?.p_payload as Record<string, unknown>
      expect(JSON.stringify(payload)).not.toMatch(/consentedAt/)
    }
    const createArgs = (rpc.mock.calls as Array<[string, Record<string, unknown>]>)[1]?.[1]
    expect(createArgs?.p_mode).toBe('create')
    expect(createArgs?.p_create_token).toBeNull()
  })

  it('uses create_separate token only when mode requires it', async () => {
    const rpc = vi.fn(async (_name: string, _args?: Record<string, unknown>) => ({
      data: {
        ok: true,
        mode: 'create_separate',
        lead_id: 'l2',
        household_id: 'h2',
        member_id: 'm2',
      },
      error: null,
    }))
    const values = {
      ...emptyContactFormValues(),
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'a@x.com',
      contact_category: 'vendor' as const,
    }
    await createManualContact({ rpc } as unknown as SupabaseClient, values, {
      mode: 'create_separate',
      createToken: 'opaque',
      includeAssignedAdvisor: true,
    })
    const args = (rpc.mock.calls as Array<[string, Record<string, unknown>]>)[0]?.[1]
    expect(args?.p_create_token).toBe('opaque')
  })
})

describe('exclusion constant', () => {
  it('shares Manual Contact household exclusion with Households/dashboard', () => {
    expect(MANUAL_CONTACT_HOUSEHOLD_EXCLUSION).toContain('manual_contact')
  })
})
