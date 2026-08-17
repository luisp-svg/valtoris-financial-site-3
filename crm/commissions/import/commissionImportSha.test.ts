import { describe, expect, it } from 'vitest'
import { isCommissionImportSha256, sha256HexFromBytes } from './commissionImportSha'

describe('commission import SHA-256', () => {
  it('hashes known bytes to lowercase 64 hex', async () => {
    const hex = await sha256HexFromBytes(new TextEncoder().encode('abc'))
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(isCommissionImportSha256(hex)).toBe(true)
    expect(hex).toBe(hex.toLowerCase())
    expect(hex).toHaveLength(64)
  })

  it('hashes raw selected bytes rather than a reconstructed filename', async () => {
    const a = await sha256HexFromBytes(new TextEncoder().encode('statement-a'))
    const b = await sha256HexFromBytes(new TextEncoder().encode('statement-b'))
    expect(a).not.toBe(b)
  })
})
