import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchIntakeQueue } from '../intake/intakeApi'
import { DIGITAL_IDENTITY_LEAD_TYPE } from '../../modules/digital-identity'

function createQuery(result: { data: unknown; error: null | object }) {
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

describe('Intake lead_type allowlist', () => {
  it('queries Family, Business, Retirement, Protection Gap, and Digital Identity', async () => {
    const leadsQuery = createQuery({ data: [], error: null })
    const from = vi.fn((table: string) => {
      if (table === 'leads') return leadsQuery
      return createQuery({ data: [], error: null })
    })
    await fetchIntakeQueue({ from } as unknown as SupabaseClient)
    expect(leadsQuery.in).toHaveBeenCalledWith('lead_type', [
      'Family Report Card',
      'Business Report Card',
      'Retirement Report Card',
      'Protection Gap',
      DIGITAL_IDENTITY_LEAD_TYPE,
    ])
    expect(leadsQuery.or).not.toHaveBeenCalled()
    expect(leadsQuery.neq).not.toHaveBeenCalled()
  })

  it('documents that NULL / future / Manual Contact types are excluded by allowlist', () => {
    const allowed = new Set([
      'Family Report Card',
      'Business Report Card',
      'Retirement Report Card',
      'Protection Gap',
      DIGITAL_IDENTITY_LEAD_TYPE,
    ])
    for (const type of [null, undefined, 'Manual Contact', 'Future Widget', '']) {
      expect(allowed.has(type as string)).toBe(false)
    }
    expect(allowed.has('Family Report Card')).toBe(true)
    expect(allowed.has('Digital Identity')).toBe(true)
  })
})
