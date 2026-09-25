import { emptyIntakeRow, validateIntakeStructure, type IntakeAnswers, type IntakeField, type IntakeSection } from './studentLoanSchema'
const field = (id: string, label: string, kind: IntakeField['kind'] = 'text', required = false): IntakeField => ({ id, label, kind, required })
const select = (id: string, label: string, options: readonly string[], required = false): IntakeField => ({ id, label, kind: 'select', options, required })
const yesNo = ['Yes', 'No', 'Not sure']
export const LIFE_INTAKE_TRACKS = ['Life insurance planning'] as const
export const LIFE_INTAKE_SECTIONS: readonly IntakeSection[] = [
  { id: 'client', title: 'Client and request', description: 'Confirm the existing contact. Intake changes do not overwrite the contact or original report.', fields: [
    field('firstName', 'Client first name', 'text', true), field('lastName', 'Client last name', 'text', true), field('email', 'Email', 'email', true), field('phone', 'Phone', 'text', true), field('state', 'Client residence state', 'text', true),
    field('goal', 'What would the client like to accomplish?', 'multiline', true), select('productInterest', 'Product interest', ['Term life', 'Permanent life', 'Indexed universal life', 'Final expense', 'Not decided', 'Other'], true), select('confirmed', 'Client identity and requested review confirmed?', ['Yes', 'Not yet'], true),
  ] },
  { id: 'insured', title: 'Proposed insured', description: 'The client, proposed insured, owner, and payer may be different people. Identify each role explicitly.', fields: [
    field('name', 'Proposed insured full legal name', 'text', true), field('relationship', 'Relationship to the client', 'text', true), field('birthDate', 'Date of birth', 'date', true), field('state', 'Insured residence state', 'text', true), select('residencyDiscussion', 'Residency discussion needed for the application?', yesNo),
  ] },
  ...(['owner', 'payer'] as const).map(id => ({ id, title: id === 'owner' ? 'Policy owner' : 'Premium payer', description: 'When different from the insured, identify the person or entity and the relationship. Do not enter bank or identity numbers.', fields: [
    select('sameAsInsured', 'Same as the proposed insured?', ['Yes', 'No'], true), select('entityType', 'If different, person or entity?', ['Person', 'Trust', 'Business', 'Other']), field('name', 'Name if different'), field('relationship', 'Relationship to insured'), field('email', 'Contact email', 'email'), field('phone', 'Contact phone'), field('reason', 'Reason for a different owner or payer', 'multiline'),
  ] })),
  { id: 'finances', title: 'Employment and finances', description: 'Confirm amounts and dates. Unknown amounts stay blank. Net worth means assets minus liabilities; liquid net worth is the portion available without selling illiquid assets.', fields: [
    field('employer', 'Employer or business'), field('occupation', 'Occupation and duties'), field('tenure', 'Employment or business tenure'), field('annualIncome', 'Gross annual income ($)', 'money'), field('asOf', 'Financial information as of', 'date'), field('monthlyBudget', 'Discretionary monthly budget ($)', 'money'), field('netWorth', 'Estimated net worth ($)', 'text'), field('liquidNetWorth', 'Estimated liquid net worth ($)', 'text'),
  ] },
  { id: 'coverage', title: 'Existing coverage', repeatable: true, description: 'Add current policies. A possible replacement requires the applicable carrier and state process; this intake does not authorize replacement.', fields: [
    field('carrier', 'Carrier', 'text', true), field('type', 'Coverage or policy type', 'text', true), field('insured', 'Insured name', 'text', true), field('amount', 'Coverage amount ($)', 'money'), select('ownership', 'Coverage source', ['Personally owned', 'Employer provided', 'Other', 'Not sure'], true), field('premium', 'Premium ($)', 'money'), select('frequency', 'Premium frequency', ['Monthly', 'Quarterly', 'Semiannual', 'Annual', 'Single', 'Other']), field('endsAt', 'Term or coverage end date', 'date'), select('replacement', 'Change or replacement being considered?', yesNo, true),
  ] },
  { id: 'beneficiaries', title: 'Beneficiaries', repeatable: true, description: 'Primary and contingent are separate groups. Each populated group must total 100% before completion. These are proposed designations, not a carrier beneficiary change.', fields: [
    select('type', 'Person or entity?', ['Person', 'Trust', 'Business', 'Other'], true), field('name', 'Full name or entity name', 'text', true), field('relationship', 'Relationship to insured', 'text', true), select('role', 'Beneficiary role', ['Primary', 'Contingent'], true), { ...field('percent', 'Allocation (%)', 'number', true), min: 0.01, max: 100 }, field('email', 'Contact email, if needed', 'email'), field('phone', 'Contact phone, if needed'),
  ] },
  { id: 'needs', title: 'Needs worksheet', description: 'The source worksheet uses 10 years of income. Review and change that assumption explicitly. Enter zero only when confirmed. This is a planning calculation, not a coverage recommendation.', fields: [
    field('debt', 'Debt excluding mortgage ($)', 'money'), field('annualIncome', 'Annual income to replace ($)', 'money'), { ...field('years', 'Years of income replacement', 'number'), min: 0, max: 100, integer: true }, field('mortgage', 'Mortgage balance ($)', 'money'), field('education', 'Education goal ($)', 'money'), field('otherNeeds', 'Final expenses and other needs ($)', 'money'), field('existingCoverage', 'Existing coverage available for these needs ($)', 'money'), field('availableAssets', 'Assets explicitly available for these needs ($)', 'money'), field('requestedCoverage', 'Client-requested coverage ($)', 'money'),
  ] },
  { id: 'dependents', title: 'Dependents and rider interest', repeatable: true, description: 'Add only dependents relevant to the review. Sensitive child information belongs in the secure carrier application.', fields: [
    field('name', 'Dependent name', 'text', true), field('relationship', 'Relationship to insured', 'text', true), field('birthDate', 'Date of birth', 'date'), select('riderInterest', 'Interested in discussing a rider?', yesNo, true),
  ] },
  { id: 'handoff', title: 'Secure application handoff', description: 'Track progress only. Medical and legal history, medications, Social Security numbers, license details, and banking information are collected through the selected carrier’s secure process. Do not paste those answers or access links here.', fields: [
    field('carrier', 'Carrier if selected'), field('product', 'Product if selected'), select('status', 'Secure application status', ['Not started', 'In progress', 'Submitted to carrier', 'Completed with carrier'], true), field('outstanding', 'Outstanding information categories only', 'multiline'), select('authorization', 'Application authorization status', ['Not requested', 'Pending', 'Recorded with carrier', 'Declined'], true), field('authorizationDate', 'Authorization recorded date', 'date'), field('evidenceReference', 'Non-sensitive evidence reference (no links or credentials)'),
  ] },
  { id: 'review', title: 'Advisor review', description: 'Completing this planning intake does not bind coverage, approve underwriting, authorize a bank draft, or issue a policy.', fields: [
    select('coverageStatus', 'Existing coverage review', ['Policies recorded', 'No existing coverage', 'Not yet confirmed'], true), select('beneficiaryStatus', 'Beneficiary selection', ['Recorded', 'To be decided'], true), select('needsReviewed', 'Needs and assumptions reviewed with the client?', ['Yes', 'Not yet'], true), field('unresolved', 'Unresolved planning items and follow-up', 'multiline'), field('reviewDate', 'Advisor review date', 'date', true),
  ] },
]
export function emptyLifeInsuranceIntake(): IntakeAnswers {
  const answers: IntakeAnswers = { version: 1, tracks: [...LIFE_INTAKE_TRACKS], sections: Object.fromEntries(LIFE_INTAKE_SECTIONS.map(s => [s.id, s.repeatable ? [] : [emptyIntakeRow(s)]])) }
  answers.sections.needs[0].years = '10'
  return answers
}
export function validateLifeInsuranceIntake(raw: unknown, complete = false): string[] {
  const errors = validateIntakeStructure(raw, LIFE_INTAKE_SECTIONS, LIFE_INTAKE_TRACKS, complete)
  if (errors.length) return errors
  const a = raw as IntakeAnswers
  const today = new Date().toISOString().slice(0, 10)
  for (const section of ['insured', 'dependents']) for (const row of a.sections[section]) {
    if (row.birthDate && (row.birthDate > today || row.birthDate < '1900-01-01')) errors.push('Birth dates must be between January 1, 1900 and today.')
  }
  for (const key of ['netWorth', 'liquidNetWorth']) {
    const value = a.sections.finances[0][key]
    if (value && (!/^-?(0|[1-9]\d*)(\.\d{1,2})?$/.test(value) || Math.abs(Number(value)) > 100_000_000)) errors.push('Net-worth amounts must be valid numbers without commas; negative values are allowed.')
  }
  if (/https?:\/\/|www\./i.test(a.sections.handoff[0].evidenceReference)) errors.push('Use a non-sensitive evidence reference, not an application link.')
  if (!complete) return errors
  for (const role of ['owner', 'payer']) {
    const row = a.sections[role][0]
    if (row.sameAsInsured === 'No' && ['entityType', 'name', 'relationship', 'reason'].some(k => !row[k].trim())) errors.push(`${role === 'owner' ? 'Owner' : 'Payer'}: identify the different person/entity, relationship and reason.`)
    if (row.sameAsInsured === 'Yes' && Object.entries(row).some(([k, v]) => k !== 'sameAsInsured' && v.trim())) errors.push(`${role === 'owner' ? 'Owner' : 'Payer'}: clear the different-person fields or choose No.`)
  }
  for (const role of ['Primary', 'Contingent']) {
    const rows = a.sections.beneficiaries.filter(r => r.role === role)
    if (rows.length && rows.reduce((sum, r) => sum + Math.round(Number(r.percent) * 100), 0) !== 10000) errors.push(`${role} beneficiary allocations must total 100%.`)
  }
  const review = a.sections.review[0]
  if (review.beneficiaryStatus === 'Recorded' && !a.sections.beneficiaries.some(r => r.role === 'Primary')) errors.push('Add at least one primary beneficiary.')
  if (review.beneficiaryStatus === 'To be decided' && a.sections.beneficiaries.length) errors.push('Choose Recorded for the entered beneficiaries, or remove the undecided entries.')
  if (review.coverageStatus === 'Policies recorded' && !a.sections.coverage.length) errors.push('Add the existing coverage records.')
  if (review.coverageStatus === 'No existing coverage' && a.sections.coverage.length) errors.push('Existing coverage records conflict with No existing coverage.')
  if ((review.beneficiaryStatus === 'To be decided' || review.coverageStatus === 'Not yet confirmed') && !review.unresolved.trim()) errors.push('Record follow-up for undecided beneficiaries or unconfirmed coverage.')
  if (review.needsReviewed !== 'Yes') errors.push('Confirm the needs and assumptions review before completing intake.')
  if (review.reviewDate > today) errors.push('The advisor review date cannot be in the future.')
  const handoff = a.sections.handoff[0]
  if (handoff.status !== 'Not started' && (!handoff.carrier.trim() || !handoff.product.trim())) errors.push('Identify the carrier and product for the application handoff.')
  if (handoff.authorization === 'Recorded with carrier' && (!handoff.authorizationDate || !handoff.evidenceReference.trim())) errors.push('Record the authorization date and non-sensitive evidence reference.')
  if (handoff.authorizationDate > today) errors.push('Authorization date cannot be in the future.')
  return errors
}
export type LifeNeedsEstimate = { grossCents: number; coverageCents: number; assetsCents: number; gapCents: number; requestedCents: number | null; differenceCents: number | null }
export function calculateLifeNeeds(answers: IntakeAnswers): LifeNeedsEstimate | null {
  const row = answers.sections.needs?.[0]
  if (!row) return null
  const moneyKeys = ['debt', 'annualIncome', 'mortgage', 'education', 'otherNeeds', 'existingCoverage', 'availableAssets']
  if (moneyKeys.some(k => !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(row[k] ?? '') || Number(row[k]) > 100_000_000) || !/^\d+$/.test(row.years) || Number(row.years) > 100) return null
  const cents = (key: string) => Math.round(Number(row[key]) * 100)
  const grossCents = cents('debt') + cents('annualIncome') * Number(row.years) + cents('mortgage') + cents('education') + cents('otherNeeds')
  const gapCents = Math.max(0, grossCents - cents('existingCoverage') - cents('availableAssets'))
  const requestedCents = /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(row.requestedCoverage ?? '') && Number(row.requestedCoverage) <= 100_000_000 ? cents('requestedCoverage') : null
  return { grossCents, coverageCents: cents('existingCoverage'), assetsCents: cents('availableAssets'), gapCents, requestedCents, differenceCents: requestedCents === null ? null : gapCents - requestedCents }
}
