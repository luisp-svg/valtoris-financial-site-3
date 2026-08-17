import type {
  ClientWorkspaceTabDefinition,
  ClientWorkspaceTabId,
  QuickActionDefinition,
} from './types'

export const CLIENT_WORKSPACE_TAB_PARAM = 'tab'

export const CLIENT_WORKSPACE_TABS: ClientWorkspaceTabDefinition[] = [
  { id: 'overview', label: 'Overview', enabled: true },
  { id: 'financial_progress', label: 'Financial Progress', enabled: true },
  { id: 'cases', label: 'Cases', enabled: true },
  { id: 'policies', label: 'Policies', enabled: true },
  { id: 'timeline', label: 'Timeline', enabled: true },
  { id: 'tasks', label: 'Tasks', enabled: true },
  { id: 'notes', label: 'Operational Notes', enabled: true },
  { id: 'documents', label: 'Documents', enabled: true },
  { id: 'reviews', label: 'Reviews', enabled: true },
  { id: 'household', label: 'Household', enabled: true },
]

/** URL slug for each internal tab id (`financial_progress` → `financial-progress`). */
export const CLIENT_WORKSPACE_TAB_SLUGS: Record<ClientWorkspaceTabId, string> = {
  overview: 'overview',
  financial_progress: 'financial-progress',
  cases: 'cases',
  policies: 'policies',
  timeline: 'timeline',
  tasks: 'tasks',
  notes: 'notes',
  documents: 'documents',
  reviews: 'reviews',
  household: 'household',
}

const SLUG_TO_TAB_ID: Record<string, ClientWorkspaceTabId> = Object.fromEntries(
  (Object.entries(CLIENT_WORKSPACE_TAB_SLUGS) as [ClientWorkspaceTabId, string][]).map(
    ([id, slug]) => [slug, id],
  ),
) as Record<string, ClientWorkspaceTabId>

export const CLIENT_WORKSPACE_QUICK_ACTIONS: QuickActionDefinition[] = [
  { id: 'add_task', label: 'Add Task', availability: 'enabled' },
  { id: 'add_note', label: 'Add Operational Note', availability: 'enabled' },
  { id: 'create_opportunity', label: 'Create Opportunity', availability: 'enabled' },
  {
    id: 'create_case',
    label: 'Create Case',
    availability: 'disabled_future',
    disabledReason: 'Available in a future phase.',
  },
  { id: 'upload_document', label: 'Upload Document', availability: 'enabled' },
  {
    id: 'schedule_review',
    label: 'Schedule Review',
    availability: 'disabled_future',
    disabledReason: 'Available in a future phase.',
  },
]

export const DEFAULT_CLIENT_WORKSPACE_TAB: ClientWorkspaceTabId = 'overview'

export function isClientWorkspaceTabId(value: string): value is ClientWorkspaceTabId {
  return CLIENT_WORKSPACE_TABS.some((tab) => tab.id === value)
}

export function isClientWorkspaceTabSlug(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(SLUG_TO_TAB_ID, value)
}

/** Resolve `?tab=` to a tab id. Missing or invalid values default to overview. */
export function tabIdFromSearchParams(params: URLSearchParams): ClientWorkspaceTabId {
  const raw = params.get(CLIENT_WORKSPACE_TAB_PARAM)
  if (!raw) return DEFAULT_CLIENT_WORKSPACE_TAB
  return SLUG_TO_TAB_ID[raw] ?? DEFAULT_CLIENT_WORKSPACE_TAB
}

export function tabSlugForId(tab: ClientWorkspaceTabId): string {
  return CLIENT_WORKSPACE_TAB_SLUGS[tab]
}

/**
 * Returns a new URLSearchParams with `tab` set for the given workspace tab.
 * Preserves unrelated query parameters.
 */
export function withWorkspaceTabParam(
  params: URLSearchParams,
  tab: ClientWorkspaceTabId,
): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set(CLIENT_WORKSPACE_TAB_PARAM, tabSlugForId(tab))
  return next
}
