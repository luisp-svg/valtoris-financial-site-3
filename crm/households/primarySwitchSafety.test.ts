import { describe, expect, it, vi } from 'vitest'
import {
  PrimarySwitchMutationError,
  recoverFromPrimarySwitchFailure,
} from './householdsApi'

describe('recoverFromPrimarySwitchFailure', () => {
  it('rethrows the original error when no previous primary was cleared', async () => {
    const operationError = new Error('insert failed')
    await expect(
      recoverFromPrimarySwitchFailure({
        context: 'create_member',
        previousPrimaryId: null,
        operationError,
        restorePrimary: vi.fn(),
      }),
    ).rejects.toBe(operationError)
  })

  it('restores previous primary then rethrows the original operation error', async () => {
    const operationError = new Error('insert failed')
    const restorePrimary = vi.fn().mockResolvedValue(undefined)

    await expect(
      recoverFromPrimarySwitchFailure({
        context: 'create_member',
        previousPrimaryId: 'prev-primary-id',
        operationError,
        restorePrimary,
      }),
    ).rejects.toBe(operationError)

    expect(restorePrimary).toHaveBeenCalledWith('prev-primary-id')
  })

  it('throws PrimarySwitchMutationError when restore also fails', async () => {
    const operationError = new Error('insert failed')
    const restoreError = new Error('restore failed')
    const restorePrimary = vi.fn().mockRejectedValue(restoreError)

    let caught: unknown
    try {
      await recoverFromPrimarySwitchFailure({
        context: 'update_member',
        previousPrimaryId: 'prev-primary-id',
        operationError,
        restorePrimary,
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(PrimarySwitchMutationError)
    const typed = caught as PrimarySwitchMutationError
    expect(typed.primaryMayBeUnset).toBe(true)
    expect(typed.previousPrimaryId).toBe('prev-primary-id')
    expect(typed.operationError).toBe(operationError)
    expect(typed.restoreError).toBe(restoreError)
    expect(typed.message).toContain('may currently have no primary contact')
    expect(typed.message).toContain('insert failed')
    expect(typed.message).toContain('restore failed')
  })
})
