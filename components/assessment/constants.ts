export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
] as const

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'domestic-partnership', label: 'Domestic Partnership' },
] as const

export const DEMO_ASSESSMENT_STEPS = 5

export const MONTHLY_CASH_FLOW_OPTIONS = [
  { value: 'save-most-months', label: 'We consistently save money most months' },
  { value: 'break-even', label: 'We usually break even' },
  { value: 'overspend', label: 'We often spend more than we take in' },
  { value: 'unsure', label: "I'm not sure" },
] as const

export const RETIREMENT_CONTRIBUTION_OPTIONS = [
  { value: 'not-saving', label: 'I am not currently saving for retirement' },
  { value: 'under-3', label: 'Less than 3% of household income' },
  { value: '3-5', label: '3% to 5% of household income' },
  { value: '6-10', label: '6% to 10% of household income' },
  { value: '11-15', label: '11% to 15% of household income' },
  { value: 'over-15', label: 'More than 15% of household income' },
] as const

export const GOAL_OPTIONS = [
  { value: 'protect-family', label: 'Protect my family' },
  { value: 'debt-free', label: 'Become debt free' },
  { value: 'build-wealth', label: 'Build wealth' },
  { value: 'reduce-taxes', label: 'Reduce taxes' },
  { value: 'retire', label: 'Retire comfortably' },
  { value: 'college', label: 'Pay for college' },
  { value: 'legacy', label: 'Leave a legacy' },
] as const

export const DEMO_ANSWERS_STORAGE_KEY = 'valtoris-demo-answers'

/** @deprecated Use DEMO_ASSESSMENT_STEPS */
export const ASSESSMENT_TOTAL_STEPS = DEMO_ASSESSMENT_STEPS
