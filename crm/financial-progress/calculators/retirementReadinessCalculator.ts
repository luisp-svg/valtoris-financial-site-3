import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const retirementReadinessCalculator: CategoryCalculator =
  createPlaceholderCalculator('retirement_readiness')
