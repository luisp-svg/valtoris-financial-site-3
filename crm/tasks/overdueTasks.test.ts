import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchVisibleTasks } from './tasksApi'

it('filters overdue open work in the database before limiting results', async () => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'is', 'in', 'order', 'lt', 'limit']) query[method] = vi.fn(() => query)
  query.then = vi.fn(resolve => resolve({ data: [], error: null }))
  const client = { from: () => query } as unknown as SupabaseClient
  await fetchVisibleTasks(client, { dueBefore: '2026-10-16', limit: 10 })
  expect(query.in).toHaveBeenCalledWith('status', ['open', 'in_progress'])
  expect(query.lt).toHaveBeenCalledWith('due_date', '2026-10-16')
  expect(query.lt.mock.invocationCallOrder[0]).toBeLessThan(query.limit.mock.invocationCallOrder[0])
  query.lt.mockClear()
  await fetchVisibleTasks(client, { completed: true, dueBefore: '2026-10-16' })
  expect(query.lt).not.toHaveBeenCalled()
  expect(query.in).toHaveBeenLastCalledWith('status', ['done'])
})
