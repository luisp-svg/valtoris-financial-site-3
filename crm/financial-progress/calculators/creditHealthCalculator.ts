import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const creditHealthCalculator: CategoryCalculator =
  createPlaceholderCalculator('credit_health')
