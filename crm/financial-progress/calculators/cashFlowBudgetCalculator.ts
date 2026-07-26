import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const cashFlowBudgetCalculator: CategoryCalculator =
  createPlaceholderCalculator('cash_flow_budget')
