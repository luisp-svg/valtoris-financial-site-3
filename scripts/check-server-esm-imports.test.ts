import { describe, expect, it } from 'vitest'
import { findExtensionlessServerImports } from './check-server-esm-imports.mjs'

describe('server ESM import contract (api/** graph)', () => {
  it('has no extensionless relative runtime imports', () => {
    const { visited, violations } = findExtensionlessServerImports()
    expect(visited.length).toBeGreaterThan(10)
    expect(violations).toEqual([])
  })

  it('includes the 043 ingest scoring graph without React card UI', () => {
    const { visited, violations } = findExtensionlessServerImports()
    expect(violations).toEqual([])
    expect(visited).toContain('api/ingest-family-report-card.ts')
    expect(visited).toContain('components/assessment/scoring/scoreBusinessAssessment.ts')
    expect(visited).toContain('components/assessment/scoring/scoreRetirementAssessment.ts')
    expect(visited).toContain('components/assessment/scoring/scoreFamilyAssessment.ts')
    expect(visited.some((path) => path.includes('PriorityRecommendationCard'))).toBe(false)
  })
})
