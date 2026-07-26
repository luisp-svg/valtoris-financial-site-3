import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const financialIndependenceCalculator: CategoryCalculator =
  createPlaceholderCalculator('financial_independence')
