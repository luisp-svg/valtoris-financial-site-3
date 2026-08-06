import { describe, expect, it } from 'vitest'
import { mapQuickAddError } from './errors'

describe('mapQuickAddError', () => {
  it('maps approved QUICK_ADD codes to safe messages', () => {
    const mapped = mapQuickAddError({ message: 'QUICK_ADD:contact_required' })
    expect(mapped.code).toBe('QUICK_ADD:contact_required')
    expect(mapped.message).toMatch(/email|phone/i)
    expect(mapped.message).not.toMatch(/postgres|PGRST|stack/i)
  })

  it('hides raw database errors', () => {
    const mapped = mapQuickAddError({
      message: 'duplicate key value violates unique constraint "leads_pkey"',
      details: 'Key (id)=(...) already exists.',
    })
    expect(mapped.code).toBe('QUICK_ADD:unknown')
    expect(mapped.message).not.toMatch(/duplicate key|leads_pkey/i)
  })
})
