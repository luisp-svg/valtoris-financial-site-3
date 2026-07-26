import type { CategoryCalculator } from '../types'
import { createPlaceholderCalculator } from './createPlaceholderCalculator'

export const estateLegacyCalculator: CategoryCalculator =
  createPlaceholderCalculator('estate_legacy')
