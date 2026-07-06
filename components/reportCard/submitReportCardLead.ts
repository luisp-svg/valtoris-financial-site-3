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
import {
  BUSINESS_PROTECTION_RATING,
  BUSINESS_REPORT_GRADE,
  BUSINESS_REPORT_SCORE,
  BUSINESS_TOP_PRIORITIES,
} from './businessReportCardData'

function stringField(value: FormDataEntryValue | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
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
    sourcePage: getSourcePage() || ROUTES.reportCard,
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
    return submitBusinessReportCardLead(formPayload)
  }

  return submitFamilyLeadFormLead(source, formPayload)
}

export async function submitBusinessReportCardLead(
  formPayload: Record<string, FormDataEntryValue>,
) {
  const fullName = stringField(formPayload.name)
  const { firstName, lastName } = splitFullName(fullName)
  const email = stringField(formPayload.email)
  const phone = stringField(formPayload.phone)
  const businessName = fullName

  const payload = buildMasterLeadPayload({
    firstName,
    lastName,
    fullName,
    email,
    phone,
    businessName,
    overallScore: BUSINESS_REPORT_SCORE,
    overallGrade: BUSINESS_REPORT_GRADE,
    protectionGap: BUSINESS_PROTECTION_RATING,
    topPriority1: BUSINESS_TOP_PRIORITIES[0]?.title ?? '',
    topPriority2: BUSINESS_TOP_PRIORITIES[1]?.title ?? '',
    topPriority3: BUSINESS_TOP_PRIORITIES[2]?.title ?? '',
    notes: stringField(formPayload.notes),
    sourcePage: getSourcePage() || ROUTES.businessReportCard,
    rawAnswers: JSON.stringify(formPayload),
  })

  return submitLeadToGoogleSheets('Business Report Card', payload)
}
