export const SERVICE_LINES = {
  pc_personal: 'P&C Personal',
  pc_commercial: 'P&C Commercial',
  health: 'Health',
  student_loans: 'Student Loans',
  credit_repair: 'Credit Repair',
  wills_trusts: 'Wills & Trusts',
  tax_strategy: 'Tax Strategy',
} as const
export type ServiceLine = keyof typeof SERVICE_LINES
export const STATUSES = {
  draft: 'Draft',
  submitted: 'Submitted',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const
export const VALUE_BASES = {
  annual_premium: 'Annual premium',
  contract_value: 'Contract / service value',
  referral_value: 'Referral value',
  recovery_value: 'Recovery value',
} as const
export const MODELS = {
  pc_split: 'P&C split',
  flat_referral: 'Flat referral',
  percent_contract: 'Percentage of contract',
  tax_recovery: 'Tax recovery',
  student_loan_service: 'Student loan service',
  credit_repair: 'Credit repair',
} as const
export type ServiceRecord = {
  id: string
  household_id: string
  opportunity_id: string
  service_line: ServiceLine
  provider_name: string
  product_name: string
  external_reference: string | null
  submission_date: string | null
  production_status: keyof typeof STATUSES
  value_cents: number | null
  value_basis: keyof typeof VALUE_BASES
  currency: 'USD'
  notes: string | null
  case_owner_user_id?: string | null
  next_follow_up_date?: string | null
  case_stage?: import('./caseModel').CaseStage | null
  case_stage_changed_at?: string | null
  waiting_reason?: string | null
  revision: number
  deleted_at: string | null
  household: { display_name: string } | null
  opportunity: { title: string } | null
}
export type Allocation = {
  id: string
  advisor_id: string
  writing_bps: number
  compensation_model: keyof typeof MODELS | null
  expected_cents: number | null
  review_status: 'unreviewed' | 'reviewed'
  review_basis: string | null
  advisor: { display_name: string } | null
}
export type ServiceHistory = {
  id: string
  event_type: string
  reason: string
  created_at: string
}
export type OpportunityOption = {
  id: string
  household_id: string
  title: string
  vertical: { code: string }
  household: { display_name: string }
}
export type WritingSplit = { advisor_id: string; percent: string }
export type ServiceDraft = {
  service_line: ServiceLine
  provider_name: string
  product_name: string
  external_reference: string
  submission_date: string
  production_status: keyof typeof STATUSES
  value: string
  value_basis: keyof typeof VALUE_BASES
  notes: string
}
export function defaultDraft(): ServiceDraft {
  return {
    service_line: 'pc_personal',
    provider_name: '',
    product_name: '',
    external_reference: '',
    submission_date: '',
    production_status: 'draft',
    value: '',
    value_basis: 'annual_premium',
    notes: '',
  }
}
export function isPremium(line: ServiceLine) {
  return ['pc_personal', 'pc_commercial', 'health'].includes(line)
}
export function linesForVertical(code: string): ServiceLine[] {
  return (Object.keys(SERVICE_LINES) as ServiceLine[]).filter(
    (line) => (line.startsWith('pc_') ? 'pc' : line) === code,
  )
}
export function money(cents: number | null) {
  return cents === null
    ? 'Not recorded'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(cents / 100)
}
export function parseCents(input: string): number | null {
  if (!input.trim()) return null
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(input.trim()))
    throw new Error(
      'Enter a positive amount with up to two decimal places, or leave it blank.',
    )
  const [whole, decimal = ''] = input.trim().split('.')
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  if (cents > 999999999999) throw new Error('The amount is too large.')
  return cents
}
export function splitPayload(splits: WritingSplit[]) {
  const rows = splits.map((s) => ({
    advisor_id: s.advisor_id,
    writing_bps: parseCents(s.percent) ?? 0,
  }))
  if (
    !rows.length ||
    rows.length > 20 ||
    rows.some(
      (r) => !r.advisor_id || r.writing_bps <= 0 || r.writing_bps > 10000,
    ) ||
    new Set(rows.map((r) => r.advisor_id)).size !== rows.length ||
    rows.reduce((n, r) => n + r.writing_bps, 0) !== 10000
  )
    throw new Error(
      'Choose each writing advisor once. Writing shares must total 100%.',
    )
  return rows
}
export function recordPayload(d: ServiceDraft) {
  if (!d.provider_name.trim() || !d.product_name.trim())
    throw new Error('Enter the provider and product or service name.')
  if (
    ['submitted', 'completed'].includes(d.production_status) &&
    !d.submission_date
  )
    throw new Error(
      'Enter the submission date before marking this submitted or completed.',
    )
  return {
    service_line: d.service_line,
    provider_name: d.provider_name.trim(),
    product_name: d.product_name.trim(),
    external_reference: d.external_reference.trim() || null,
    submission_date: d.submission_date || null,
    production_status: d.production_status,
    value_cents: parseCents(d.value),
    value_basis: d.value_basis,
    notes: d.notes.trim() || null,
  }
}
export function draftFromRecord(r: ServiceRecord): ServiceDraft {
  return {
    service_line: r.service_line,
    provider_name: r.provider_name,
    product_name: r.product_name,
    external_reference: r.external_reference ?? '',
    submission_date: r.submission_date ?? '',
    production_status: r.production_status,
    value: r.value_cents === null ? '' : (r.value_cents / 100).toFixed(2),
    value_basis: r.value_basis,
    notes: r.notes ?? '',
  }
}
export function serviceError(e: unknown): string {
  const message =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? String(e.message)
        : ''
  const caseErrors: Record<string, string> = {
    blocking_requirements:
      'Resolve, waive or cancel open blocking requirements before marking this case ready or complete.',
    case_not_active:
      'Case work is available on submitted records. An owner must reopen a closed record first.',
    owner_reopen_required:
      'Only an owner can reopen a completed or cancelled record.',
    owner_assignment_required:
      'Only an owner can change case ownership or assign another user.',
    ineligible_assignee:
      'Choose an active user who already has access to this client.',
    ready_case_blocker:
      'Move the case back to In progress before adding or reopening a blocking requirement.',
    invalid_requirement_transition:
      'This requirement cannot move directly to that status. Reopen it first when allowed.',
    reason_required: 'Enter a reason for this change.',
  }
  for (const [code, text] of Object.entries(caseErrors))
    if (message.includes(code)) return text
  if (message.includes('stale_record'))
    return 'This record changed while you were editing. Reload it before trying again.'
  if (message.includes('not_found'))
    return 'This record is unavailable or you no longer have access.'
  if (message.includes('invalid_splits'))
    return 'Choose active writing advisors with shares totaling 100%.'
  if (message.includes('opportunity_already_used'))
    return 'This opportunity already has a production record.'
  if (message.includes('opportunity_closed'))
    return 'Choose an open, on-hold, or won opportunity.'
  if (message.includes('invalid_service_line'))
    return 'The service line must match the selected opportunity.'
  if (message.includes('invalid_model'))
    return 'Choose a compensation model that fits this service line.'
  if (/^(Enter |Choose |The amount)/.test(message)) return message
  return 'Unable to complete this request. Your changes may not have saved. Reload to check, then try again.'
}
