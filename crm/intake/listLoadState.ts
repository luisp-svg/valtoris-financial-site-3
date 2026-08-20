import type { IntakeFilterId } from './types'

export type IntakeListViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'filtered_empty' }
  | { kind: 'ready'; count: number }

export function getIntakeListViewState(options: {
  loading: boolean
  error: string | null
  totalCount: number
  filteredCount: number
}): IntakeListViewState {
  if (options.loading) return { kind: 'loading' }
  if (options.error) return { kind: 'error', message: options.error }
  if (options.totalCount === 0) return { kind: 'empty' }
  if (options.filteredCount === 0) return { kind: 'filtered_empty' }
  return { kind: 'ready', count: options.filteredCount }
}

export type IntakeListPresentation = 'table' | 'cards'

export function getIntakeListPresentation(viewportWidth: number): IntakeListPresentation {
  return viewportWidth < 900 ? 'cards' : 'table'
}

export const INTAKE_FILTER_OPTIONS: Array<{ id: IntakeFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'new_prospects', label: 'New prospects' },
  { id: 'exact_matches', label: 'Exact matches' },
  { id: 'possible_duplicates', label: 'Possible duplicates' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'assigned_to_me', label: 'Assigned to me' },
  { id: 'sheets_failed', label: 'Sheets sync issue' },
]

export function emptyStateCopy(filter: IntakeFilterId): { title: string; body: string } {
  switch (filter) {
    case 'possible_duplicates':
      return {
        title: 'No possible duplicates',
        body: 'There are no public Report Card or Protection Gap submissions waiting for duplicate review.',
      }
    case 'sheets_failed':
      return {
        title: 'No Sheets sync issues',
        body: 'CRM remains the system of record. No secondary Sheets sync failures are visible right now.',
      }
    case 'needs_review':
      return {
        title: 'Nothing needs review',
        body: 'There are no pending duplicate reviews in your visible intake queue.',
      }
    case 'new_prospects':
      return {
        title: 'No new prospects',
        body: 'No provisional new public Report Card or Protection Gap prospects match this filter.',
      }
    case 'exact_matches':
      return {
        title: 'No exact matches',
        body: 'No trusted household matches appear in the current intake queue.',
      }
    case 'resolved':
      return {
        title: 'No resolved reviews',
        body: 'Resolved duplicate reviews will appear here once migration 021 resolution is available.',
      }
    case 'unassigned':
      return {
        title: 'No unassigned leads',
        body: 'Every visible intake lead currently has an assigned advisor, or none are visible under your access.',
      }
    case 'assigned_to_me':
      return {
        title: 'Nothing assigned to you',
        body: 'No incoming public Report Card, Protection Gap, or Digital Identity leads are assigned to your advisor profile.',
      }
    default:
      return {
        title: 'No incoming leads yet',
        body: 'When a prospect completes a public Report Card, Protection Gap, or Let’s Connect form, the lead will appear here.',
      }
  }
}
