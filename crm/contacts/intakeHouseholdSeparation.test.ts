import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchIntakeQueue } from '../intake/intakeApi'
import { MANUAL_CONTACT_HOUSEHOLD_EXCLUSION } from './exclusions'

const ROOT = join(import.meta.dirname, '../..')

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

describe('Intake / Households / dashboard Manual Contact separation', () => {
  it('Intake query uses an explicit Family/DI allowlist (Manual Contact never eligible)', async () => {
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
      'Digital Identity',
    ])
    expect(leadsQuery.or).not.toHaveBeenCalled()
  })

  it('Households and dashboard apply Manual Contact exclusion filter', () => {
    const householdsApi = readFileSync(join(ROOT, 'crm/households/householdsApi.ts'), 'utf8')
    const dashboardApi = readFileSync(join(ROOT, 'crm/dashboard/dashboardApi.ts'), 'utf8')
    expect(householdsApi).toContain('MANUAL_CONTACT_HOUSEHOLD_EXCLUSION')
    expect(dashboardApi).toContain('MANUAL_CONTACT_HOUSEHOLD_EXCLUSION')
    expect(householdsApi).toContain('.or(MANUAL_CONTACT_HOUSEHOLD_EXCLUSION)')
    expect(dashboardApi).toContain('.or(MANUAL_CONTACT_HOUSEHOLD_EXCLUSION)')
    expect(MANUAL_CONTACT_HOUSEHOLD_EXCLUSION).toContain('lead_source.neq.manual_contact')
  })

  it('Contacts list only selects Manual Contact lead type via browser client path', () => {
    const api = readFileSync(join(ROOT, 'crm/contacts/contactsApi.ts'), 'utf8')
    const page = readFileSync(join(ROOT, 'pages/crm/CrmContactsPage.tsx'), 'utf8')
    expect(api).toContain(".eq('lead_type', 'Manual Contact')")
    expect(api).not.toMatch(/SERVICE_ROLE|createSupabaseAdmin/)
    expect(page).toContain('createSupabaseBrowserClient')
  })
})
