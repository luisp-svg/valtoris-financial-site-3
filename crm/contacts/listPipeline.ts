import type { ContactListFilters, ContactListItem } from './types'

/**
 * Phase Q1B Contacts list strategy (option A):
 * Fetch the complete RLS-visible Manual Contact dataset up to this bound,
 * then filter + paginate in the browser.
 *
 * Bound is intentionally well above the initial ~100-card requirement so
 * contacts cannot be silently hidden by a 25-row server page.
 */
export const CONTACTS_FETCH_CAP = 500

export const CONTACTS_PAGE_SIZE = 25

export function matchesContactSearch(item: ContactListItem, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const phoneDigits = (item.phone ?? '').replace(/\D/g, '')
  const qDigits = q.replace(/\D/g, '')
  return (
    item.fullName.toLowerCase().includes(q) ||
    (item.company ?? '').toLowerCase().includes(q) ||
    (item.email ?? '').toLowerCase().includes(q) ||
    (item.phone ?? '').toLowerCase().includes(q) ||
    (qDigits.length >= 3 && phoneDigits.includes(qDigits))
  )
}

/** Stable sort key: newest first, then leadId for tie-breaks (no page drift). */
export function compareContactsStable(a: ContactListItem, b: ContactListItem): number {
  const aDate = a.dateEntered ?? ''
  const bDate = b.dateEntered ?? ''
  if (aDate !== bDate) return aDate < bDate ? 1 : -1
  if (a.leadId === b.leadId) return 0
  return a.leadId < b.leadId ? 1 : -1
}

/**
 * Apply client-side filters to the full fetched Manual Contact set.
 * Order: category → assigned advisor → search → stable sort.
 */
export function filterManualContacts(
  items: ContactListItem[],
  filters: Pick<ContactListFilters, 'search' | 'category' | 'assignedAdvisorId'>,
): ContactListItem[] {
  let next = items
  if (filters.category !== 'all') {
    next = next.filter((item) => item.category === filters.category)
  }
  if (filters.assignedAdvisorId !== 'all') {
    next = next.filter((item) => item.assignedAdvisorId === filters.assignedAdvisorId)
  }
  if (filters.search.trim()) {
    next = next.filter((item) => matchesContactSearch(item, filters.search))
  }
  return [...next].sort(compareContactsStable)
}

/** Client-side page slice after filtering. */
export function paginateManualContacts(
  filtered: ContactListItem[],
  page: number,
  pageSize: number,
): { items: ContactListItem[]; total: number; page: number; pageSize: number } {
  const size = pageSize > 0 ? pageSize : CONTACTS_PAGE_SIZE
  const safePage = Math.max(1, page)
  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / size))
  const clampedPage = Math.min(safePage, pageCount)
  const start = (clampedPage - 1) * size
  return {
    items: filtered.slice(start, start + size),
    total,
    page: clampedPage,
    pageSize: size,
  }
}

export function isContactsFetchCapped(fetchedRowCount: number, cap = CONTACTS_FETCH_CAP): boolean {
  return fetchedRowCount >= cap
}
