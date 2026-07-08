export const BUSINESS_ASSESSMENT_STEPS = 6

export const BUSINESS_INDUSTRY_OPTIONS = [
  { value: 'financial-insurance', label: 'Financial Services / Insurance' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'construction-trades', label: 'Construction / Trades' },
  { value: 'real-estate', label: 'Real Estate' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'retail-ecommerce', label: 'Retail / E-commerce' },
  { value: 'restaurant-food', label: 'Restaurant / Food Service' },
  { value: 'transportation-logistics', label: 'Transportation / Logistics' },
  { value: 'technology', label: 'Technology' },
  { value: 'personal-services', label: 'Personal Services' },
  { value: 'other', label: 'Other' },
] as const

export const LEGAL_ENTITY_STRUCTURE_OPTIONS = [
  { value: 'sole-prop', label: 'Sole Proprietorship' },
  { value: 'single-member-llc', label: 'Single-Member LLC' },
  { value: 'multi-member-llc', label: 'Multi-Member LLC' },
  { value: 's-corp', label: 'S Corporation' },
  { value: 'c-corp', label: 'C Corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'not-sure', label: 'Not Sure' },
] as const

export const YEARS_IN_BUSINESS_OPTIONS = [
  { value: 'under-2', label: 'Less than 2 years' },
  { value: '2-5', label: '2–5 years' },
  { value: '6-10', label: '6–10 years' },
  { value: '11-20', label: '11–20 years' },
  { value: 'over-20', label: 'More than 20 years' },
] as const

export const EMPLOYEE_COUNT_OPTIONS = [
  { value: 'solo', label: 'Just me' },
  { value: '2-5', label: '2–5 employees' },
  { value: '6-20', label: '6–20 employees' },
  { value: '21-50', label: '21–50 employees' },
  { value: '51plus', label: '51+ employees' },
] as const

export const GROSS_ANNUAL_REVENUE_OPTIONS = [
  { value: 'pre-revenue', label: 'Pre-revenue' },
  { value: 'under-100k', label: 'Under $100,000' },
  { value: '100k-249k', label: '$100,000–$249,999' },
  { value: '250k-499k', label: '$250,000–$499,999' },
  { value: '500k-999k', label: '$500,000–$999,999' },
  { value: '1m-2.49m', label: '$1 million–$2.49 million' },
  { value: '2.5m-4.99m', label: '$2.5 million–$4.99 million' },
  { value: '5m-plus', label: '$5 million+' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const

export const OWNER_COMPENSATION_METHOD_OPTIONS = [
  { value: 'payroll', label: 'Regular payroll / W-2 salary' },
  { value: 'owners-draw', label: "Owner's draw" },
  { value: 'distributions', label: 'Distributions' },
  { value: 'salary-plus-distributions', label: 'Salary plus distributions' },
  { value: 'irregular-transfers', label: 'Irregular transfers when cash is available' },
  { value: 'not-consistent', label: 'I do not consistently pay myself' },
  { value: 'not-sure', label: 'Not sure' },
] as const

export const OWNER_PERSONAL_INCOME_OPTIONS = [
  { value: 'zero', label: '$0 / Not currently taking income' },
  { value: 'under-50k', label: 'Under $50,000' },
  { value: '50k-99k', label: '$50,000–$99,999' },
  { value: '100k-199k', label: '$100,000–$199,999' },
  { value: '200k-499k', label: '$200,000–$499,999' },
  { value: '500k-plus', label: '$500,000+' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const

export const CARD_SALES_PERCENTAGE_OPTIONS = [
  { value: 'under-25', label: 'Less than 25%' },
  { value: '25-49', label: '25–49%' },
  { value: '50-74', label: '50–74%' },
  { value: '75-100', label: '75–100%' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const ESTIMATED_PROCESSING_RATE_OPTIONS = [
  { value: 'under-2', label: 'Under 2%' },
  { value: '2-2.49', label: '2.00–2.49%' },
  { value: '2.5-2.99', label: '2.50–2.99%' },
  { value: '3-3.49', label: '3.00–3.49%' },
  { value: '3.5-plus', label: '3.50% or higher' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const LAST_PROCESSING_REVIEW_OPTIONS = [
  { value: 'within-6mo', label: 'Within the last 6 months' },
  { value: '6-12mo', label: '6–12 months ago' },
  { value: 'over-12mo', label: 'More than 12 months ago' },
  { value: 'never', label: 'Never' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const OPERATING_DOCS_OPTIONS = [
  { value: 'current', label: 'Yes, reviewed within the last 2 years' },
  { value: 'needs-update', label: 'Yes, but may need updates' },
  { value: 'none', label: 'No formal documents in place' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const FINANCE_SEPARATION_OPTIONS = [
  { value: 'fully-separated', label: 'Fully separated (accounts, records, taxes)' },
  { value: 'mostly-separated', label: 'Mostly separated with minor overlap' },
  { value: 'some-mingled', label: 'Some personal and business expenses mingled' },
  { value: 'not-separated', label: 'Not meaningfully separated' },
] as const

export const OPERATING_CASH_FLOW_OPTIONS = [
  { value: 'positive-reinvest', label: 'Consistently positive with room to reinvest' },
  { value: 'break-even', label: 'Generally break even' },
  { value: 'tight-seasonal', label: 'Tight or highly seasonal' },
  { value: 'negative', label: 'Often negative or cash-strapped' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const RESERVE_MONTHS_OPTIONS = [
  { value: '6plus', label: '6+ months' },
  { value: '3-5', label: '3–5 months' },
  { value: '1-2', label: '1–2 months' },
  { value: 'none', label: 'None dedicated' },
] as const

export const REVENUE_PREDICTABILITY_OPTIONS = [
  { value: 'very-predictable', label: 'Very predictable (contracts/recurring)' },
  { value: 'mostly-predictable', label: 'Mostly predictable' },
  { value: 'seasonal', label: 'Seasonal or cyclical' },
  { value: 'unpredictable', label: 'Highly unpredictable' },
] as const

export const TAX_PLANNING_OPTIONS = [
  { value: 'proactive', label: 'Proactive strategies reviewed annually with advisor' },
  { value: 'annual-review', label: 'Annual tax review, limited proactive planning' },
  { value: 'compliance-only', label: 'Compliance-focused (file and pay)' },
  { value: 'none', label: 'No formal tax planning' },
] as const

export const TAX_BENEFIT_STRATEGIES_OPTIONS = [
  { value: 'yes-multiple', label: 'Yes, multiple strategies in place' },
  { value: 'yes-basic', label: 'Yes, basic strategies (e.g., SEP/SIMPLE)' },
  { value: 'considering', label: 'Considering but not implemented' },
  { value: 'no', label: 'No' },
] as const

export const KEY_PERSON_BUYSELL_OPTIONS = [
  { value: 'yes-funded', label: 'Yes, funded and documented' },
  { value: 'yes-unfunded', label: 'Yes, documented but not fully funded' },
  { value: 'planning', label: 'In planning' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const CONTINUITY_PLAN_OPTIONS = [
  { value: 'documented', label: 'Yes, documented continuity plan' },
  { value: 'informal', label: 'Probably, informal arrangements' },
  { value: 'no', label: 'No, business would face major disruption' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const CORE_INSURANCE_OPTIONS = [
  { value: 'yes-reviewed', label: 'Yes, reviewed annually for business size' },
  { value: 'yes-basic', label: 'Yes, basic coverage in place' },
  { value: 'partial', label: 'Partial coverage or unknown limits' },
  { value: 'no', label: 'No commercial coverage' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const SPECIALIZED_COVERAGE_OPTIONS = [
  { value: 'comprehensive', label: 'Yes, comprehensive review within 2 years' },
  { value: 'standard', label: 'Yes, standard review' },
  { value: 'partial', label: 'Partial / some gaps identified' },
  { value: 'no', label: 'No specialized review' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const OWNER_RETIREMENT_SAVINGS_OPTIONS = [
  { value: 'over-15', label: 'More than 15% of personal income' },
  { value: '11-15', label: '11–15% of personal income' },
  { value: '6-10', label: '6–10% of personal income' },
  { value: 'under-5', label: 'Less than 5%' },
  { value: 'not-saving', label: 'Not currently saving' },
] as const

export const BUSINESS_CREDIT_OPTIONS = [
  { value: 'established', label: 'Established business credit, monitored regularly' },
  { value: 'building', label: 'Building business credit' },
  { value: 'personal', label: 'Primarily rely on personal credit' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const GROWTH_CAPITAL_OPTIONS = [
  { value: 'readily', label: 'Readily available (LOC, financing)' },
  { value: 'limited', label: 'Available but limited' },
  { value: 'personal-guarantee', label: 'Only with personal guarantees' },
  { value: 'difficult', label: 'Difficult to access' },
] as const

export const SUCCESSION_PLAN_OPTIONS = [
  { value: 'documented', label: 'Yes, documented and reviewed within 2 years' },
  { value: 'informal', label: 'Informally discussed, not documented' },
  { value: 'none', label: 'Not addressed' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const VALUATION_BASELINE_OPTIONS = [
  { value: 'recent', label: 'Yes, within the last 2 years' },
  { value: 'outdated', label: 'Yes, but outdated' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const BUSINESS_GOAL_OPTIONS = [
  { value: 'protect-key-people', label: 'Protect key people & revenue' },
  { value: 'improve-cash-flow', label: 'Improve cash flow & reserves' },
  { value: 'reduce-taxes', label: 'Reduce taxes' },
  { value: 'strengthen-credit', label: 'Strengthen business credit' },
  { value: 'build-owner-wealth', label: 'Build owner wealth outside the business' },
  { value: 'plan-exit', label: 'Plan for exit or succession' },
  { value: 'reduce-risk', label: 'Reduce operational risk' },
  { value: 'optimize-structure', label: 'Optimize business structure' },
] as const
