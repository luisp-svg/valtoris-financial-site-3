import { describe, expect, it } from 'vitest'
import { findExtensionlessServerImports } from './check-server-esm-imports.mjs'

describe('server ESM import contract (api/** graph)', () => {
  it('has no extensionless relative runtime imports', () => {
    const { visited, violations } = findExtensionlessServerImports()
    expect(visited.length).toBeGreaterThan(10)
    expect(violations).toEqual([])
  })
})
