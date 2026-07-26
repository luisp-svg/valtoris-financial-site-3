import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const protectionInsuranceCalculator: CategoryCalculator =
  createPlaceholderCalculator('protection_insurance')
