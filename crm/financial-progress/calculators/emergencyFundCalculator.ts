import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const emergencyFundCalculator: CategoryCalculator =
  createPlaceholderCalculator('emergency_fund')
