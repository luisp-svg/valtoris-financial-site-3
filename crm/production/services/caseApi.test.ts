import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listServiceRecords } from './api'
it('filters overdue requirements on the server before paging, under RLS', async () => {
  const calls: unknown[][] = []
  const q: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  for (const name of [
    'select',
    'order',
    'range',
    'not',
    'is',
    'eq',
    'in',
    'lt',
  ])
    q[name] = (...args: unknown[]) => {
      calls.push([name, ...args])
      return q
    }
  const client = { from: vi.fn(() => q) } as unknown as SupabaseClient
  await listServiceRecords(client, 50, false, 'overdue_requirements')
  expect(calls).toContainEqual(['range', 50, 99])
  expect(calls).toContainEqual(['eq', 'production_status', 'submitted'])
  expect(calls).toContainEqual([
    'in',
    'requirements.status',
    ['open', 'scheduled'],
  ])
  expect(calls).toContainEqual(['is', 'requirements.deleted_at', null])
  expect(
    calls.some(
      (c) =>
        c[0] === 'select' &&
        String(c[1]).includes('service_production_requirements!inner'),
    ),
  ).toBe(true)
  expect(
    calls.some((c) => c[0] === 'lt' && c[1] === 'requirements.due_date'),
  ).toBe(true)
})
