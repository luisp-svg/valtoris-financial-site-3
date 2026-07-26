import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const debtManagementCalculator: CategoryCalculator =
  createPlaceholderCalculator('debt_management')
