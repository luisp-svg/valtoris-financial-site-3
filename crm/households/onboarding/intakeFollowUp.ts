import type { OnboardingSectionId } from './onboardingSections'

/** Optional advisor intake; existing section fields remain the source for shared facts. */
export const INTAKE_FOLLOW_UP_GROUPS = [
  {
    "id": "business_profile",
    "section": "income",
    "title": "Business details",
    "description": "For a household with a business. Use existing income sources for income amounts.",
    "fields": [
      {
        "id": "business_name",
        "label": "Business name"
      },
      {
        "id": "business_employees",
        "label": "Number of full-time employees"
      },
      {
        "id": "business_compensation",
        "label": "How does the owner pay themselves?"
      },
      {
        "id": "business_operating_documents",
        "label": "Operating agreement and ownership-document review status"
      },
      {
        "id": "business_revenue_predictability",
        "label": "Revenue seasonality or recurring contracts"
      },
      {
        "id": "business_tax_strategies",
        "label": "Retirement or benefit strategies currently used by the business"
      },
      {
        "id": "business_professional_contacts",
        "label": "Business accountant, attorney, or other professional contacts"
      }
    ]
  },
  {
    "id": "business_processing",
    "section": "cash-flow",
    "title": "Business card payments",
    "description": "Complete when the business accepts card payments.",
    "fields": [
      {
        "id": "business_accepts_cards",
        "label": "Does the business accept credit or debit cards?"
      },
      {
        "id": "business_card_sales",
        "label": "Approximate share of sales paid by card (%)"
      },
      {
        "id": "business_processing_rate",
        "label": "Estimated card-processing rate (%)"
      },
      {
        "id": "business_processing_review",
        "label": "When were processing costs last reviewed?"
      }
    ]
  },
  {
    "id": "business_funding",
    "section": "assets",
    "title": "Business funding and value",
    "description": "Use the asset schedule above for business ownership and its value.",
    "fields": [
      {
        "id": "business_credit",
        "label": "Business credit profile and monitoring"
      },
      {
        "id": "business_growth_capital",
        "label": "Available credit lines or other growth funding"
      },
      {
        "id": "business_personal_guarantees",
        "label": "Personal guarantees attached to business borrowing"
      },
      {
        "id": "business_valuation_review",
        "label": "Date and basis of the latest business valuation"
      }
    ]
  },
  {
    "id": "business_protection",
    "section": "insurance",
    "title": "Business protection review",
    "description": "Use the coverage schedule above for policies, carriers, amounts and premiums.",
    "fields": [
      {
        "id": "business_key_person",
        "label": "Key-person protection review and gaps"
      },
      {
        "id": "business_buy_sell_funding",
        "label": "Buy-sell agreement funding status"
      },
      {
        "id": "business_continuity",
        "label": "Who can maintain operations if an owner is unavailable?"
      },
      {
        "id": "business_specialized_review",
        "label": "Cyber, professional-liability and umbrella review findings"
      }
    ]
  },
  {
    "id": "business_exit",
    "section": "estate",
    "title": "Business succession and exit",
    "description": "Use the existing succession and buy-sell planning items above for document status.",
    "fields": [
      {
        "id": "business_exit_timeline",
        "label": "Preferred exit or succession timeline"
      },
      {
        "id": "business_successor",
        "label": "Proposed successor or transfer approach"
      }
    ]
  },
  {
    "id": "education_protection",
    "section": "insurance",
    "title": "Education and protection assumptions",
    "description": "Record details for the advisor review. Use household members for dependent information.",
    "fields": [
      {
        "id": "protection_income_years",
        "label": "Income-replacement period requested (years)"
      },
      {
        "id": "protection_housing_years",
        "label": "Housing-protection period requested (years)"
      },
      {
        "id": "protection_education_total",
        "label": "Total education funding goal (USD)"
      },
      {
        "id": "protection_education_allocation",
        "label": "Education funding allocation by dependent"
      },
      {
        "id": "protection_final_expenses",
        "label": "Requested final-expense reserve (USD)"
      }
    ]
  },
  {
    "id": "student_loans",
    "section": "debts",
    "title": "Student-loan follow-up",
    "description": "Use the debt schedule for each loan\u2019s creditor, balance, rate and payment. Do not enter account numbers or login details.",
    "fields": [
      {
        "id": "student_servicer",
        "label": "Student-loan servicer name(s)"
      },
      {
        "id": "student_employment_tenure",
        "label": "Time in the current employment type"
      },
      {
        "id": "student_plan_details",
        "label": "Current repayment plan name and details to confirm"
      }
    ]
  },
  {
    "id": "credit_review",
    "section": "debts",
    "title": "Credit-review follow-up",
    "description": "No Social Security numbers, dates of birth, account numbers or bureau credentials.",
    "fields": [
      {
        "id": "credit_account_count",
        "label": "Number of open revolving accounts"
      },
      {
        "id": "credit_new_accounts",
        "label": "Number and approximate opening dates of recently opened accounts"
      },
      {
        "id": "credit_previous_help",
        "label": "Previous credit counseling, disputes or credit-help services"
      },
      {
        "id": "credit_payment_pattern",
        "label": "Current payment consistency and any recent changes"
      }
    ]
  },
  {
    "id": "home_purchase",
    "section": "goals",
    "title": "Home-buying details",
    "description": "Use existing income, asset and debt schedules for the financial breakdown.",
    "fields": [
      {
        "id": "home_type",
        "label": "New construction, resale or either?"
      },
      {
        "id": "home_first_time",
        "label": "First-time home buyer?"
      },
      {
        "id": "home_current_situation",
        "label": "Current housing situation"
      },
      {
        "id": "home_target_price",
        "label": "Target home price (USD)"
      },
      {
        "id": "home_applicants",
        "label": "Who plans to apply?"
      },
      {
        "id": "home_other_applicant",
        "label": "Will another applicant\u2019s income be included?"
      },
      {
        "id": "home_gift_assistance",
        "label": "Confirmed or possible gift / down-payment assistance"
      },
      {
        "id": "home_readiness_confidence",
        "label": "How prepared does the household feel?"
      },
      {
        "id": "home_obstacles",
        "label": "What could prevent the purchase?"
      },
      {
        "id": "home_expected_tenure",
        "label": "Expected years in the home"
      }
    ]
  },
  {
    "id": "home_costs",
    "section": "cash-flow",
    "title": "Housing after purchase",
    "description": "Keep current household expenses in the cash-flow fields above.",
    "fields": [
      {
        "id": "home_retained_housing",
        "label": "Housing obligations continuing after purchase (USD/month)"
      },
      {
        "id": "home_hoa",
        "label": "Expected HOA or condominium fees (USD/month)"
      },
      {
        "id": "home_required_support",
        "label": "Required support or alimony payments (USD/month)"
      }
    ]
  },
  {
    "id": "home_funds",
    "section": "assets",
    "title": "Purchase funds and reserves",
    "description": "Use the asset schedule above for balances. Avoid counting the same funds twice.",
    "fields": [
      {
        "id": "home_purchase_funds",
        "label": "Funds available for purchase after protecting reserves (USD)"
      },
      {
        "id": "home_protected_reserves",
        "label": "Reserves excluded from purchase funds (USD)"
      }
    ]
  },
  {
    "id": "home_team",
    "section": "goals",
    "title": "Home-buying team",
    "description": "Professional contact details only; include another person\u2019s details only when authorized.",
    "fields": [
      {
        "id": "home_lender",
        "label": "Loan officer or lender name"
      },
      {
        "id": "home_lender_contact",
        "label": "Lender\u2019s business contact details"
      },
      {
        "id": "home_preapproval",
        "label": "Prequalification or preapproval status and date"
      },
      {
        "id": "home_agent",
        "label": "Real-estate agent name"
      },
      {
        "id": "home_agent_contact",
        "label": "Agent\u2019s business contact details"
      },
      {
        "id": "home_loan_product",
        "label": "Loan options discussed with the lender (or unknown)"
      },
      {
        "id": "home_financing_assumptions",
        "label": "Lender-provided rate, loan term, and down-payment assumptions (include estimate date)"
      },
      {
        "id": "home_ownership_costs",
        "label": "Estimated property taxes, homeowners insurance, and mortgage insurance (USD/month)"
      },
      {
        "id": "home_closing_costs",
        "label": "Estimated closing costs and any seller or lender credits (USD)"
      },
      {
        "id": "home_affordability_review",
        "label": "Detailed affordability review: estimate, source, date, and missing information"
      }
    ]
  },
  {
    "id": "retirement_household",
    "section": "retirement",
    "title": "Retirement household and timeline",
    "description": "Use household members for ages and relationships and the asset schedule for account balances.",
    "fields": [
      {
        "id": "retirement_spouse_target",
        "label": "Spouse or partner\u2019s target retirement age"
      },
      {
        "id": "retirement_plan_clarity",
        "label": "Is there a written retirement plan?"
      },
      {
        "id": "retirement_primary_motivation",
        "label": "Primary retirement motivation"
      }
    ]
  },
  {
    "id": "retirement_income",
    "section": "retirement",
    "title": "Expected retirement income",
    "description": "Estimates in today\u2019s dollars. Unknown is different from zero.",
    "fields": [
      {
        "id": "retirement_social_security",
        "label": "Expected Social Security income (USD/month)"
      },
      {
        "id": "retirement_spouse_social_security",
        "label": "Expected spouse or partner Social Security income (USD/month)"
      },
      {
        "id": "retirement_pension",
        "label": "Expected pension income (USD/month)"
      },
      {
        "id": "retirement_annuity",
        "label": "Expected annuity income (USD/month)"
      },
      {
        "id": "retirement_rental",
        "label": "Expected rental income (USD/month)"
      },
      {
        "id": "retirement_business",
        "label": "Expected business income (USD/month)"
      },
      {
        "id": "retirement_other",
        "label": "Other recurring retirement income (USD/month)"
      },
      {
        "id": "retirement_temporary_income",
        "label": "Expected temporary work income (USD/month)"
      },
      {
        "id": "retirement_temporary_years",
        "label": "Expected duration of temporary retirement work (years)"
      },
      {
        "id": "retirement_estimate_review",
        "label": "Date / status of official Social Security estimate review"
      },
      {
        "id": "retirement_pension_election",
        "label": "Pension election options understood or still to review"
      },
      {
        "id": "retirement_survivor",
        "label": "Survivor-income continuation provisions"
      },
      {
        "id": "retirement_inflation",
        "label": "Inflation assumptions reviewed with the household"
      }
    ]
  },
  {
    "id": "retirement_investments",
    "section": "retirement",
    "title": "Investment and tax review",
    "description": "Use the asset schedule for retirement-account balances and ownership.",
    "fields": [
      {
        "id": "retirement_contribution_consistency",
        "label": "Contribution consistency"
      },
      {
        "id": "retirement_allocation",
        "label": "Current investment allocation and concentration concerns"
      },
      {
        "id": "retirement_allocation_review",
        "label": "Date of last allocation review"
      },
      {
        "id": "retirement_tax_plan",
        "label": "Retirement tax-planning approach"
      },
      {
        "id": "retirement_roth",
        "label": "Roth contributions or conversions already in use"
      },
      {
        "id": "retirement_medicare",
        "label": "Medicare preparation / enrollment status"
      },
      {
        "id": "retirement_long_term_care",
        "label": "Long-term-care funding plan"
      }
    ]
  }
] as const satisfies readonly { id: string; section: OnboardingSectionId; title: string; description: string; fields: readonly { id: string; label: string }[] }[]

export type IntakeFollowUpFieldId = (typeof INTAKE_FOLLOW_UP_GROUPS)[number]['fields'][number]['id']
export type IntakeFollowUpAnswers = Partial<Record<IntakeFollowUpFieldId, string>>
export const INTAKE_FOLLOW_UP_MAX_LENGTH = 500

export function normalizeIntakeFollowUp(raw: unknown): IntakeFollowUpAnswers {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const result: IntakeFollowUpAnswers = {}
  for (const group of INTAKE_FOLLOW_UP_GROUPS) {
    for (const field of group.fields) {
      const value = source[field.id]
      if (typeof value === 'string' && value.trim()) {
        result[field.id] = value.slice(0, INTAKE_FOLLOW_UP_MAX_LENGTH)
      }
    }
  }
  return result
}
