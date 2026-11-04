import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { IntakeSaveUnconfirmedError, withIntakeSaveDeadline } from './intakeSaveDeadline'
import { saveStudentLoanIntake } from './studentLoanApi'
import { emptyStudentLoanIntake } from './studentLoanSchema'

afterEach(() => vi.useRealTimers())
describe('intake save deadline', () => {
  it('keeps an unresponsive draft request from waiting forever, without retrying or changing answers', async () => {
    vi.useFakeTimers()
    let finish!: (value: { data: null; error: null }) => void
    const rpc = vi.fn(() => new Promise<{ data: null; error: null }>(resolve => { finish = resolve }))
    const answers = emptyStudentLoanIntake()
    answers.sections.client[0].firstName = 'Synthetic'
    const snapshot = JSON.stringify(answers)
    const saving = saveStudentLoanIntake({ rpc } as unknown as SupabaseClient, { kind: 'member', id: 'member', householdId: 'household' }, answers, null, false)
    const rejected = expect(saving).rejects.toBeInstanceOf(IntakeSaveUnconfirmedError)
    await vi.advanceTimersByTimeAsync(30_000)
    await rejected
    finish({ data: null, error: null })
    await vi.runAllTimersAsync()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(answers)).toBe(snapshot)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('returns confirmed responses and clears its timer', async () => {
    vi.useFakeTimers()
    await expect(withIntakeSaveDeadline(Promise.resolve('confirmed'))).resolves.toBe('confirmed')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('preserves immediate errors and clears its timer', async () => {
    vi.useFakeTimers()
    await expect(withIntakeSaveDeadline(Promise.reject(new Error('offline')))).rejects.toThrow('offline')
    expect(vi.getTimerCount()).toBe(0)
  })
})
