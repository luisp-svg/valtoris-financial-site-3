import { BusinessAssessmentAnswers } from '../assessment/business/types'
import { scoreBusinessAssessment } from '../assessment/scoring/scoreBusinessAssessment'
import { DemoAssessmentAnswers } from '../assessment/types'
import { scoreFamilyAssessment } from '../assessment/scoring/scoreFamilyAssessment'
import { parseAmount } from '../calculator/calculations'
import { ROUTES } from '../../constants/routes'
import { buildMasterLeadPayload } from '../../utils/masterLeadPayload'
import {
  getSourcePage,
  splitFullName,
  submitLeadToGoogleSheets,
} from '../../utils/submitLeadToGoogleSheets'

function stringField(value: FormDataEntryValue | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function revenueBandMidpoint(revenue: string): number | '' {
  switch (revenue) {
    case 'pre-revenue':
      return 0
    case 'under-100k':
      return 50000
    case '100k-249k':
      return 175000
    case '250k-499k':
      return 375000
    case '500k-999k':
      return 750000
    case '1m-2.49m':
      return 1750000
    case '2.5m-4.99m':
      return 3750000
    case '5m-plus':
      return 7500000
    case 'prefer-not-to-say':
      return ''
    default:
      return ''
  }
}

export async function submitFamilyReportCardLead(answers: DemoAssessmentAnswers) {
  const scored = scoreFamilyAssessment(answers)
  const firstName = answers.family.firstName.trim()
  const lastName = answers.family.lastName.trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const monthlyHousing = parseAmount(answers.financial.monthlyHousingPayment)
  const totalDebt = parseAmount(answers.financial.totalDebt)

  const payload = buildMasterLeadPayload({
    firstName,
    lastName,
    fullName,
    email: answers.family.email.trim(),
    phone: answers.family.phone.trim(),
    age: answers.family.age.trim(),
    state: answers.family.state.trim(),
    maritalStatus: answers.family.maritalStatus.trim(),
    children: answers.family.numberOfChildren.trim(),
    annualIncome: parseAmount(answers.financial.householdIncome),
    annualHousing: monthlyHousing > 0 ? monthlyHousing * 12 : '',
    creditCards: totalDebt,
    existingCoverage: parseAmount(answers.protection.currentLifeInsurance),
    overallScore: scored.overallScore,
    overallGrade: scored.overallGrade,
    protectionGap: scored.protectionGapFormatted,
    topPriority1: scored.priorities[0]?.title ?? '',
    topPriority2: scored.priorities[1]?.title ?? '',
    topPriority3: scored.priorities[2]?.title ?? '',
    calendlyBooked: '',
    strategySessionDate: '',
    leadStatus: '',
    assignedAdvisor: '',
    notes: '',
    sourcePage: getSourcePage() || ROUTES.familyAssessment,
    rawAnswers: JSON.stringify(answers),
  })

  return submitLeadToGoogleSheets('Family Report Card', payload)
}

export async function submitFamilyLeadFormLead(
  source: string,
  formPayload: Record<string, FormDataEntryValue>,
) {
  const fullName = stringField(formPayload.name)
  const { firstName, lastName } = splitFullName(fullName)
  const email = stringField(formPayload.email)
  const phone = stringField(formPayload.phone)

  const payload = buildMasterLeadPayload({
    firstName,
    lastName,
    fullName,
    email,
    phone,
    notes: stringField(formPayload.notes),
    sourcePage: getSourcePage() || ROUTES.checkup,
    rawAnswers: JSON.stringify({ ...formPayload, source }),
  })

  return submitLeadToGoogleSheets('Family Report Card', payload)
}

export async function submitLeadFormLead(
  source: string,
  formPayload: Record<string, FormDataEntryValue>,
) {
  if (source === 'business-financial-report-card') {
    return submitBusinessLeadFormLead(formPayload)
  }

  return submitFamilyLeadFormLead(source, formPayload)
}

export async function submitBusinessLeadFormLead(
  formPayload: Record<string, FormDataEntryValue>,
) {
  const fullName = stringField(formPayload.name)
  const { firstName, lastName } = splitFullName(fullName)
  const email = stringField(formPayload.email)
  const phone = stringField(formPayload.phone)

  const payload = buildMasterLeadPayload({
    firstName,
    lastName,
    fullName,
    email,
    phone,
    businessName: stringField(formPayload.businessName) || fullName,
    notes: stringField(formPayload.notes),
    sourcePage: getSourcePage() || ROUTES.businessReportCard,
    rawAnswers: JSON.stringify(formPayload),
  })

  return submitLeadToGoogleSheets('Business Report Card', payload)
}

export async function submitBusinessReportCardLead(answers: BusinessAssessmentAnswers) {
  const scored = scoreBusinessAssessment(answers)
  const firstName = answers.owner.firstName.trim()
  const lastName = answers.owner.lastName.trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  const payload = buildMasterLeadPayload({
    firstName,
    lastName,
    fullName,
    email: answers.owner.email.trim(),
    phone: answers.owner.phone.trim(),
    businessName: answers.business.name.trim(),
    businessType: answers.business.industry.trim(),
    businessIndustry: answers.business.industry.trim(),
    entityStructure: answers.foundation.entityStructure.trim(),
    grossAnnualRevenue: answers.business.grossAnnualRevenue.trim(),
    ownerCompensationMethod: answers.business.ownerCompensationMethod.trim(),
    ownerPersonalIncome: answers.business.ownerPersonalIncome.trim(),
    acceptsCardPayments: answers.cashFlowTax.acceptsCardPayments.trim(),
    cardSalesPercentage: answers.cashFlowTax.cardSalesPercentage.trim(),
    estimatedProcessingRate: answers.cashFlowTax.estimatedProcessingRate.trim(),
    lastProcessingReview: answers.cashFlowTax.lastProcessingReview.trim(),
    annualIncome: revenueBandMidpoint(answers.business.grossAnnualRevenue),
    overallScore: scored.overallScore,
    overallGrade: scored.overallGrade,
    protectionGap: scored.protectionRating,
    topPriority1: scored.priorities[0]?.title ?? '',
    topPriority2: scored.priorities[1]?.title ?? '',
    topPriority3: scored.priorities[2]?.title ?? '',
    calendlyBooked: '',
    strategySessionDate: '',
    leadStatus: '',
    assignedAdvisor: '',
    notes: '',
    sourcePage: getSourcePage() || ROUTES.businessAssessment,
    rawAnswers: JSON.stringify(answers),
  })

  return submitLeadToGoogleSheets('Business Report Card', payload)
}
