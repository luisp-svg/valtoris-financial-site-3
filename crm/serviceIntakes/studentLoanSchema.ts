/** Detailed private intake; never used to rescore a public report card. */
export type IntakeField = {
  id: string
  label: string
  kind?: 'text' | 'email' | 'date' | 'money' | 'number' | 'multiline' | 'select'
  options?: readonly string[]
  required?: boolean
  min?: number
  max?: number
  integer?: boolean
}
export type IntakeSection = {
  id: string
  title: string
  description: string
  fields: readonly IntakeField[]
  repeatable?: boolean
  track?: string
}
const yesNo = ['Yes', 'No', 'Not sure'] as const
const field = (id: string, label: string, kind: IntakeField['kind'] = 'text', required = false): IntakeField => ({ id, label, kind, required })
const select = (id: string, label: string, options: readonly string[], required = false): IntakeField => ({ id, label, kind: 'select', options, required })
export const STUDENT_LOAN_TRACKS = ['Repayment review', 'PSLF review', 'Delinquency or default', 'Borrower Defense review', 'General review'] as const
export const STUDENT_LOAN_INTAKE_SECTIONS: readonly IntakeSection[] = [
  { id: 'client', title: 'Client and request', description: 'Confirm the existing client information. Changes here stay with this intake until separately updated in the contact record.', fields: [
    field('firstName', 'Legal first name', 'text', true), field('lastName', 'Legal last name', 'text', true), field('email', 'Email', 'email', true), field('phone', 'Phone', 'text', true),
    field('state', 'State of residence', 'text', true), select('borrowerRole', 'Whose loans are being reviewed?', ['My own loans', 'Loans I borrowed for my child', 'Loans I co-signed', 'Someone else’s loans', 'Not sure'], true),
    field('goal', 'What would you like help with?', 'multiline', true), select('accountAccess', 'Can you access your accounts yourself?', ['Yes', 'No', 'Need help'], true),
    select('deadlineNotice', 'Have you received a notice with a deadline?', yesNo, true), field('deadline', 'Notice deadline, if known', 'date'), field('noticeType', 'Notice type'),
    select('contactPreference', 'Preferred contact method', ['Email', 'Phone', 'Text', 'No preference']), field('language', 'Preferred language'), field('contactWindow', 'Best time to contact'),
    select('confirmed', 'Client information and requested review confirmed?', ['Yes', 'Not yet'], true),
  ] },
  { id: 'loans', title: 'Loan inventory', repeatable: true, description: 'Add each loan or identified loan group. Use masked references only. Unknown amounts stay blank; enter zero only when confirmed.', fields: [
    select('type', 'Loan classification', ['Federal', 'Private', 'Not sure'], true), field('subtype', 'Loan program or subtype'), field('borrower', 'Legal borrower', 'text', true), field('servicer', 'Servicer or lender', 'text', true),
    field('reference', 'Loan label or masked reference'), field('school', 'School'), field('disbursedAt', 'Disbursement date', 'date'), field('consolidatedAt', 'Consolidation date, if applicable', 'date'), field('priorLoanTypes', 'Underlying loans if consolidated'),
    field('balance', 'Balance ($)', 'money'), field('balanceDate', 'Balance as of', 'date'), field('interestRate', 'Interest rate (%)', 'number'), select('rateType', 'Rate type', ['Fixed', 'Variable', 'Not sure']),
    field('plan', 'Repayment plan shown on the account'), field('payment', 'Scheduled monthly payment ($)', 'money'), field('nextDueAt', 'Next payment due', 'date'),
    select('status', 'Current loan status', ['Repayment', 'Deferment', 'Forbearance', 'Delinquent', 'Default', 'In school', 'Grace period', 'Paid off', 'Not sure'], true),
    field('pauseReason', 'Pause reason, if applicable'), field('pauseEndsAt', 'Pause end date', 'date'), field('pastDue', 'Past-due amount ($)', 'money'),
    field('count', 'Reported payment count', 'number'), select('countType', 'Payment count type', ['PSLF qualifying', 'PSLF eligible', 'IDR', 'Other', 'Not sure']), field('evidence', 'Evidence source and date'), field('pendingRequest', 'Pending application or request'),
  ] },
  { id: 'income', title: 'Income and household', track: 'Repayment review', description: 'Record current income separately from tax-return income. Collect spouse information only when needed for the review.', fields: [
    select('maritalStatus', 'Marital status', ['Single', 'Married', 'Separated', 'Divorced', 'Widowed', 'Other', 'Prefer to discuss']),
    field('taxYear', 'Most recent filed tax year', 'number'), select('filingStatus', 'Tax filing status', ['Single', 'Married filing jointly', 'Married filing separately', 'Head of household', 'Qualifying surviving spouse', 'No return filed', 'Not sure']),
    field('agi', 'Adjusted gross income on that return ($)', 'money'), field('householdSize', 'Reported household size', 'number'), field('taxDependents', 'Tax dependents', 'number'),
    field('currentIncome', 'Current income amount ($)', 'money'), select('incomePeriod', 'Income frequency', ['Weekly', 'Every two weeks', 'Twice monthly', 'Monthly', 'Annual', 'Not sure']),
    select('incomeBasis', 'Income amount is', ['Gross', 'Net', 'No current taxable income', 'Not sure']), field('sources', 'Income sources and additional amounts', 'multiline'),
    field('change', 'Recent income or employment change', 'multiline'), field('spouseRelevant', 'Spouse information needed for this review and source', 'multiline'), field('recertificationDue', 'Recertification deadline, if known', 'date'),
  ] },
  { id: 'employment', title: 'PSLF employment history', track: 'PSLF review', repeatable: true, description: 'Add each employer and employment period, including simultaneous employers. These answers do not establish eligibility.', fields: [
    field('employer', 'Legal employer name', 'text', true), field('ein', 'Federal employer EIN'), field('address', 'Employer address'), field('start', 'Employment start date', 'date', true), field('end', 'End date, if no longer employed', 'date'), select('current', 'Still employed here?', yesNo, true), field('hours', 'Average hours per week', 'number'),
    field('official', 'HR or certifying official name and title'), field('email', 'Certifying official email', 'email'), field('phone', 'Employer contact phone'), field('priorCertification', 'Previously submitted periods and status', 'multiline'), field('countEvidence', 'Payment-count evidence and disputed periods', 'multiline'),
  ] },
  { id: 'default', title: 'Delinquency or default review', track: 'Delinquency or default', description: 'Identify affected loans and urgent notices. No remedy is selected automatically.', fields: [
    field('affectedLoans', 'Affected loans and servicers', 'multiline', true), field('lastPayment', 'Last payment date', 'date'), field('statusSince', 'Reported status start date', 'date'), field('notices', 'Collection notices or deadlines', 'multiline'), field('priorActions', 'Prior rehabilitation, consolidation, disputes and outcomes', 'multiline'),
  ] },
  { id: 'schools', title: 'Borrower Defense review', track: 'Borrower Defense review', repeatable: true, description: 'Record the client’s own account. Missing evidence is a follow-up item, not proof for or against a claim.', fields: [
    field('school', 'School and campus', 'text', true), field('program', 'Program or degree', 'text', true), field('credential', 'Credential pursued or earned'), field('start', 'Attendance start date', 'date'), field('end', 'Attendance end date', 'date'), select('attendanceStatus', 'Attendance status', ['Graduated', 'Withdrew', 'Transferred', 'Still attending', 'Not sure']),
    field('relatedLoans', 'Related loans'), field('representation', 'What was said or omitted?', 'multiline', true), field('whoWhenHow', 'Who, when, and how was it communicated?', 'multiline'), field('reliance', 'How did this affect the decision to enroll or borrow?', 'multiline'), field('harm', 'Harm reported by the client', 'multiline'), field('evidence', 'Available evidence and what it supports', 'multiline'), field('priorApplication', 'Prior application date, reference, and status', 'multiline'),
  ] },
  { id: 'documents', title: 'Document checklist', repeatable: true, description: 'Track needed evidence. Do not paste document contents, account credentials, or sensitive identifiers here. Uploads use a separately approved secure process.', fields: [
    select('category', 'Document category', ['Loan statement', 'Loan history', 'Income evidence', 'Tax evidence', 'Employment certification', 'School evidence', 'Notice or correspondence', 'Authorization', 'Other'], true),
    field('relatedTo', 'Related loan, employer, or school'), select('status', 'Review status', ['Needed', 'Requested', 'Received', 'Under review', 'Accepted for this step', 'Replacement needed', 'Unavailable', 'Not applicable'], true), field('documentDate', 'Document date', 'date'), field('coveredPeriod', 'Period covered'), field('requestedAt', 'Requested date', 'date'), field('receivedAt', 'Received date', 'date'), field('reviewNote', 'Missing information or review note', 'multiline'),
  ] },
]
export type IntakeAnswers = { version: 1; tracks: string[]; sections: Record<string, Record<string, string>[]> }
export function emptyStudentLoanIntake(): IntakeAnswers {
  return { version: 1, tracks: [], sections: Object.fromEntries(STUDENT_LOAN_INTAKE_SECTIONS.map(s => [s.id, s.repeatable ? [] : [emptyIntakeRow(s)]])) }
}
export function emptyIntakeRow(section: IntakeSection): Record<string, string> {
  return Object.fromEntries(section.fields.map(f => [f.id, '']))
}
export function visibleIntakeSections(answers: IntakeAnswers) {
  return STUDENT_LOAN_INTAKE_SECTIONS.filter(s => !s.track || answers.tracks.includes(s.track))
}
export function validateStudentLoanIntake(raw: unknown, complete = false): string[] {
  return validateIntakeStructure(raw, STUDENT_LOAN_INTAKE_SECTIONS, STUDENT_LOAN_TRACKS, complete, ['loans', 'employment', 'schools'])
}
export function validateIntakeStructure(raw: unknown, sections: readonly IntakeSection[], tracks: readonly string[], complete = false, requiredRows: readonly string[] = []): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['Invalid intake.']
  const a = raw as IntakeAnswers
  if (a.version !== 1 || Object.keys(a).some(k => !['version', 'tracks', 'sections'].includes(k)) || !Array.isArray(a.tracks) || a.tracks.some(t => !tracks.includes(t)) || new Set(a.tracks).size !== a.tracks.length || !a.sections || typeof a.sections !== 'object' || Array.isArray(a.sections)) return ['Invalid intake structure.']
  const errors: string[] = []
  if (complete && !a.tracks.length) errors.push('Choose at least one review track.')
  if (Object.keys(a.sections).some(k => !sections.some(s => s.id === k))) errors.push('Unknown section.')
  for (const s of sections) {
    const rows = a.sections[s.id]
    if (!Array.isArray(rows) || rows.length > 50 || (!s.repeatable && rows.length !== 1)) { errors.push(`${s.title}: invalid records.`); continue }
    const active = !s.track || a.tracks.includes(s.track)
    if (complete && active && requiredRows.includes(s.id) && !rows.length) errors.push(`${s.title}: add at least one record.`)
    for (const [i, row] of rows.entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(k => !s.fields.some(f => f.id === k))) { errors.push(`${s.title}: invalid fields.`); continue }
      for (const f of s.fields) {
        const v = row[f.id]
        const label = `${s.title} ${i + 1} — ${f.label}`
        if (typeof v !== 'string' || v.length > (f.kind === 'multiline' ? 2000 : 300)) { errors.push(`${label}: invalid value.`); continue }
        if (complete && active && f.required && !v.trim()) errors.push(`${label}: required.`)
        if (!v) continue
        if (f.kind === 'select' && !f.options?.includes(v)) errors.push(`${label}: choose a listed option.`)
        if (f.kind === 'money' && (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(v) || Number(v) > 100_000_000)) errors.push(`${label}: enter a nonnegative amount, without commas.`)
        if (f.kind === 'number' && (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) > 1_000_000)) errors.push(`${label}: enter a valid number.`)
        if ((f.kind === 'number' || f.kind === 'money') && ((f.min !== undefined && Number(v) < f.min) || (f.max !== undefined && Number(v) > f.max) || (f.integer && !Number.isInteger(Number(v))))) errors.push(`${label}: outside the allowed range.`)
        if (f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push(`${label}: enter a valid email.`)
        if (f.kind === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v)) errors.push(`${label}: enter a valid date.`)
      }
    }
  }
  if (complete && a.sections.client?.[0]?.confirmed !== 'Yes') errors.push('Confirm the client information before completing intake.')
  return errors
}
