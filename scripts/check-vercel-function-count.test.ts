import { describe, expect, it } from 'vitest'
import {
  assertVercelFunctionBudget,
  countedServerlessFunctions,
  EXPECTED_MAX_SERVERLESS_FUNCTIONS,
  HOBBY_SERVERLESS_FUNCTION_LIMIT,
} from './check-vercel-function-count.mjs'

describe('Vercel Hobby Serverless Function budget', () => {
  it('keeps counted api/ files at or under the expected max with headroom under Hobby 12', () => {
    const result = assertVercelFunctionBudget()
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.counted.length).toBeLessThanOrEqual(EXPECTED_MAX_SERVERLESS_FUNCTIONS)
    expect(result.counted.length).toBeLessThanOrEqual(HOBBY_SERVERLESS_FUNCTION_LIMIT)
    expect(result.tests).toEqual([])
  })

  it('does not count any colocated api/**/*.test.ts files', () => {
    const counted = countedServerlessFunctions()
    expect(counted.some((p) => p.includes('.test.'))).toBe(false)
    expect(counted).toHaveLength(10)
  })
})
