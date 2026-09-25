import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import StudentLoanIntakeForm from './StudentLoanIntakeForm'
import { emptyStudentLoanIntake, emptyIntakeRow, STUDENT_LOAN_INTAKE_SECTIONS, validateStudentLoanIntake, visibleIntakeSections } from './studentLoanSchema'
import { parseIntakeOrigin, studentLoanIntakePath } from './intakeSource'
import { normalizeSavedStudentLoanIntake, saveStudentLoanIntake } from './studentLoanApi'
const household = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'
const origin = { kind: 'contact' as const, id: sourceId, householdId: household }
const savedRow = () => ({ id: sourceId, household_id: household, assessment_type: 'student_loan_intake', capture_channel: 'advisor_onboarding', status: 'draft', updated_at: '2026-09-25T00:00:00Z', completed_at: null, answers: emptyStudentLoanIntake() })
describe('Post-report-card or existing-contact intake', () => {
  it('requires exactly one existing origin and a household', () => {
    expect(parseIntakeOrigin(household, new URLSearchParams())).toBeNull()
    expect(parseIntakeOrigin(household, new URLSearchParams({ contact: sourceId, report: sourceId }))).toBeNull()
    expect(parseIntakeOrigin('invalid', new URLSearchParams({ contact: sourceId }))).toBeNull()
    for (const key of ['contact','report']) expect(parseIntakeOrigin(household, new URLSearchParams({ [key]: sourceId }))?.id).toBe(sourceId)
    expect(studentLoanIntakePath(origin)).toContain(`contact=${sourceId}`)
  })
  it('allows incomplete drafts but never treats them as a completed intake', () => {
    const answers = emptyStudentLoanIntake()
    expect(validateStudentLoanIntake(answers)).toEqual([])
    expect(validateStudentLoanIntake(answers, true)).toContain('Choose at least one review track.')
    expect(validateStudentLoanIntake(answers, true)).toContain('Loan inventory: add at least one record.')
  })
  it('keeps unknown values distinct from zero and rejects malformed amounts and dates', () => {
    const a = emptyStudentLoanIntake()
    const s = STUDENT_LOAN_INTAKE_SECTIONS.find(s => s.id === 'loans')!
    a.sections.loans = [emptyIntakeRow(s)]
    for (const balance of ['', '0', '15000.50']) { a.sections.loans[0].balance = balance; expect(validateStudentLoanIntake(a)).toEqual([]) }
    for (const balance of ['-1', '1e5', 'NaN', '1,000', '1.001']) { a.sections.loans[0].balance = balance; expect(validateStudentLoanIntake(a).length).toBeGreaterThan(0) }
    a.sections.loans[0].balance = ''
    a.sections.loans[0].disbursedAt = '2026-02-30'
    expect(validateStudentLoanIntake(a).some(e => e.includes('valid date'))).toBe(true)
  })
  it('rejects unknown fields and invalid enum values before any database request', async () => {
    const a = emptyStudentLoanIntake()
    a.sections.client[0].ssn = 'test-value'
    const rpc = vi.fn()
    await expect(saveStudentLoanIntake({ rpc } as unknown as SupabaseClient, origin, a, null, false)).rejects.toThrow('invalid fields')
    expect(rpc).not.toHaveBeenCalled()
    delete a.sections.client[0].ssn
    a.sections.client[0].borrowerRole = 'invented'
    expect(validateStudentLoanIntake(a).length).toBeGreaterThan(0)
  })
  it('shows the appropriate branches while preserving off-track draft evidence', () => {
    const a = emptyStudentLoanIntake()
    a.tracks = ['PSLF review']
    expect(visibleIntakeSections(a).map(s => s.id)).toContain('employment')
    expect(visibleIntakeSections(a).map(s => s.id)).not.toContain('schools')
    const html = renderToStaticMarkup(createElement(StudentLoanIntakeForm, { answers: a, onChange: () => {} }))
    expect(html).toContain('Add pslf employment history record')
    expect(html).not.toContain('School and campus')
    expect(html).toContain('Do not enter passwords')
  })
  it('validates every repeatable entry, not just the first one', () => {
    const a = emptyStudentLoanIntake()
    const s = STUDENT_LOAN_INTAKE_SECTIONS.find(s => s.id === 'employment')!
    a.sections.employment = [emptyIntakeRow(s), { ...emptyIntakeRow(s), email: 'invalid' }]
    expect(validateStudentLoanIntake(a).some(e => e.includes('2 — Certifying official email'))).toBe(true)
  })
  it('requires an acknowledged save for the same household and version', async () => {
    const row = savedRow()
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null })
    const saved = await saveStudentLoanIntake({ rpc } as unknown as SupabaseClient, origin, row.answers, null, false)
    expect(saved.status).toBe('draft')
    expect(rpc).toHaveBeenCalledWith('save_student_loan_intake', expect.objectContaining({ p_origin_kind: 'contact', p_origin_id: sourceId, p_household_id: household, p_complete: false }))
    expect(() => normalizeSavedStudentLoanIntake({ ...row, household_id: sourceId }, household)).toThrow()
    expect(() => normalizeSavedStudentLoanIntake({ ...row, assessment_type: 'student_loan' }, household)).toThrow()
    expect(() => normalizeSavedStudentLoanIntake({ ...row, status: 'completed', completed_at: row.updated_at }, household)).toThrow('completed intake')
  })
  it('surfaces conflicting edits without silently overwriting them', async () => {
    const row = savedRow()
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'INTAKE:conflict' } })
    await expect(saveStudentLoanIntake({ rpc } as unknown as SupabaseClient, origin, row.answers, normalizeSavedStudentLoanIntake(row, household), false)).rejects.toThrow('Another advisor')
    expect(rpc).toHaveBeenCalledWith('save_student_loan_intake', expect.objectContaining({ p_expected_updated_at: row.updated_at }))
  })
})
