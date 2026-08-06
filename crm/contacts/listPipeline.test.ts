import { describe, expect, it } from 'vitest'
import {
  CONTACTS_FETCH_CAP,
  CONTACTS_PAGE_SIZE,
  compareContactsStable,
  filterManualContacts,
  isContactsFetchCapped,
  matchesContactSearch,
  paginateManualContacts,
} from './listPipeline'
import type { ContactListItem } from './types'

function makeContact(
  index: number,
  overrides: Partial<ContactListItem> = {},
): ContactListItem {
  const n = String(index).padStart(3, '0')
  // Monotonic dates: higher index = newer → after DESC sort, low indexes land on page 2.
  return {
    leadId: `lead-${n}`,
    householdId: `hh-${n}`,
    fullName: `Person ${n}`,
    company: index === 5 ? 'UniqueCo Outside Page1' : `Company ${n}`,
    jobTitle: null,
    category: index % 2 === 0 ? 'vendor' : 'potential_client',
    categoryLabel: index % 2 === 0 ? 'Vendor' : 'Potential client',
    email: index === 6 ? 'needle@outside.example' : `p${n}@example.com`,
    phone: index === 7 ? '(555) 999-8888' : `555000${n}`,
    city: null,
    state: null,
    locationLabel: null,
    assignedAdvisorId: index % 3 === 0 ? 'adv-a' : 'adv-b',
    assignedAdvisorName: index % 3 === 0 ? 'Advisor A' : 'Advisor B',
    howWeMet: null,
    dateEntered: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    followUpTaskSummary: null,
    ...overrides,
  }
}

/** 40 contacts — page size 25 means indices on page 2 when unfiltered after sort. */
function buildForty(): ContactListItem[] {
  return Array.from({ length: 40 }, (_, i) => makeContact(i))
}

describe('Contacts list pipeline (>25 contacts)', () => {
  it('documents fetch cap comfortably above the initial ~100-card requirement', () => {
    expect(CONTACTS_FETCH_CAP).toBeGreaterThanOrEqual(100)
    expect(CONTACTS_FETCH_CAP).toBe(500)
    expect(CONTACTS_PAGE_SIZE).toBe(25)
    expect(isContactsFetchCapped(500)).toBe(true)
    expect(isContactsFetchCapped(100)).toBe(false)
  })

  it('finds name/company/email/phone matches that would sit outside UI page 1', () => {
    const all = buildForty().sort(compareContactsStable)
    const page1 = paginateManualContacts(all, 1, 25).items
    expect(page1).toHaveLength(25)

    const byName = filterManualContacts(all, {
      search: 'Person 005',
      category: 'all',
      assignedAdvisorId: 'all',
    })
    expect(byName.some((c) => c.fullName === 'Person 005')).toBe(true)
    // Ensure the needle is not only discoverable via page-1 slice
    expect(page1.some((c) => c.fullName === 'Person 005')).toBe(false)

    const byCompany = filterManualContacts(all, {
      search: 'UniqueCo Outside Page1',
      category: 'all',
      assignedAdvisorId: 'all',
    })
    expect(byCompany).toHaveLength(1)
    expect(byCompany[0].company).toBe('UniqueCo Outside Page1')

    const byEmail = filterManualContacts(all, {
      search: 'needle@outside.example',
      category: 'all',
      assignedAdvisorId: 'all',
    })
    expect(byEmail).toHaveLength(1)

    const byPhone = filterManualContacts(all, {
      search: '5559998888',
      category: 'all',
      assignedAdvisorId: 'all',
    })
    expect(byPhone).toHaveLength(1)
    expect(matchesContactSearch(byPhone[0], '999-8888')).toBe(true)
  })

  it('category and advisor filters include matches from the full loaded set', () => {
    const all = buildForty()
    const vendors = filterManualContacts(all, {
      search: '',
      category: 'vendor',
      assignedAdvisorId: 'all',
    })
    expect(vendors.length).toBe(20)
    expect(vendors.every((c) => c.category === 'vendor')).toBe(true)

    const advA = filterManualContacts(all, {
      search: '',
      category: 'all',
      assignedAdvisorId: 'adv-a',
    })
    expect(advA.length).toBeGreaterThan(10)
    expect(advA.every((c) => c.assignedAdvisorId === 'adv-a')).toBe(true)
  })

  it('paginates without skips/duplicates and keeps stable ordering', () => {
    const filtered = filterManualContacts(buildForty(), {
      search: '',
      category: 'all',
      assignedAdvisorId: 'all',
    })
    const p1 = paginateManualContacts(filtered, 1, 25)
    const p2 = paginateManualContacts(filtered, 2, 25)
    expect(p1.total).toBe(40)
    expect(p1.items).toHaveLength(25)
    expect(p2.items).toHaveLength(15)

    const ids = [...p1.items, ...p2.items].map((c) => c.leadId)
    expect(new Set(ids).size).toBe(40)

    for (let i = 1; i < filtered.length; i++) {
      expect(compareContactsStable(filtered[i - 1], filtered[i])).toBeLessThanOrEqual(0)
    }

    // Same filter twice → identical page membership
    const again = paginateManualContacts(
      filterManualContacts(buildForty(), {
        search: '',
        category: 'all',
        assignedAdvisorId: 'all',
      }),
      2,
      25,
    )
    expect(again.items.map((c) => c.leadId)).toEqual(p2.items.map((c) => c.leadId))
  })

  it('UI page reset contract: filters are applied before slicing so page 1 shows match results', () => {
    const filtered = filterManualContacts(buildForty(), {
      search: 'UniqueCo',
      category: 'all',
      assignedAdvisorId: 'all',
    })
    const page = paginateManualContacts(filtered, 1, 25)
    expect(page.page).toBe(1)
    expect(page.items).toHaveLength(1)
    expect(page.total).toBe(1)
  })
})
