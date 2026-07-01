export const CALCULATOR_TOTAL_STEPS = 7

export const CALCULATOR_STORAGE_KEY = 'valtoris-protection-calculator'

export const INCOME_REPLACEMENT_OPTIONS = [
  { value: '10', label: '10 Years' },
  { value: '15', label: '15 Years (Recommended)', badge: 'Recommended' },
  { value: '20', label: '20 Years' },
  { value: 'custom', label: 'Custom' },
] as const

export const COLLEGE_FUND_OPTIONS = [
  { value: '50000', label: '$50,000' },
  { value: '100000', label: '$100,000' },
  { value: '150000', label: '$150,000' },
  { value: 'custom', label: 'Custom' },
] as const

export const FINAL_EXPENSE_OPTIONS = [
  { value: '15000', label: '$15,000' },
  { value: '25000', label: '$25,000' },
  { value: '50000', label: '$50,000' },
  { value: 'custom', label: 'Custom' },
] as const

export const HOUSING_TYPE_OPTIONS = [
  { value: 'own', label: 'Own a Home' },
  { value: 'rent', label: 'Rent' },
] as const

export { US_STATES, MARITAL_STATUS_OPTIONS } from '../assessment/constants'
