import { afterEach, describe, expect, it, vi } from 'vitest'
import { deferredAuthRefresh } from './deferredAuthRefresh'

afterEach(() => vi.useRealTimers())
describe('CRM authentication refresh', () => {
  it('does not enter Supabase while auth notifications hold their lock', async () => {
    vi.useFakeTimers()
    let notificationLock = true
    const refresh = vi.fn(async () => { expect(notificationLock).toBe(false) })
    const listener = deferredAuthRefresh(refresh)
    listener.onChange('TOKEN_REFRESHED')
    expect(refresh).not.toHaveBeenCalled()
    notificationLock = false
    await vi.runAllTimersAsync()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('coalesces auth notifications and cancels pending work on unmount', async () => {
    vi.useFakeTimers()
    const refresh = vi.fn(async () => {})
    const listener = deferredAuthRefresh(refresh)
    listener.onChange('INITIAL_SESSION')
    await vi.runAllTimersAsync()
    expect(refresh).not.toHaveBeenCalled()
    listener.onChange('SIGNED_IN')
    listener.onChange('TOKEN_REFRESHED')
    await vi.runAllTimersAsync()
    expect(refresh).toHaveBeenCalledTimes(1)
    listener.onChange('SIGNED_OUT')
    listener.dispose()
    listener.onChange('SIGNED_IN')
    await vi.runAllTimersAsync()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
