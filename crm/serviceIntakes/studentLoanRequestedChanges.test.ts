import { describe, it, expect } from 'vitest'
import { emptyStudentLoanIntake, validateStudentLoanIntake, validateSavedStudentLoanIntake } from './studentLoanSchema'
describe('Student loan DOB and account access', () => {
  it('requires DOB before completing a new intake', () => {
    expect(validateStudentLoanIntake(emptyStudentLoanIntake(), true).some(e => e.includes('Date of birth') && e.includes('required'))).toBe(true)
  })
  it('rejects impossible and future birth dates', () => {
    const a = emptyStudentLoanIntake()
    for (const dob of ['2025-02-30', '2999-01-01']) {
      a.sections.client[0].dateOfBirth = dob
      expect(validateStudentLoanIntake(a).length).toBeGreaterThan(0)
    }
    a.sections.client[0].dateOfBirth = '1980-02-29'
    expect(validateStudentLoanIntake(a)).toEqual([])
  })
  it('keeps legacy drafts readable without silently satisfying new completion requirements', () => {
    const a = emptyStudentLoanIntake()
    delete a.sections.client[0].dateOfBirth
    delete a.sections.client[0].fsaLoginReady
    delete a.sections.client[0].fsaDataStatus
    delete a.sections.client[0].fsaDataDate
    expect(validateStudentLoanIntake(a)).toEqual([])
    expect(validateStudentLoanIntake(a, true).some(e => e.includes('Date of birth'))).toBe(true)
    expect(validateSavedStudentLoanIntake(a, true).some(e => e.includes('Date of birth'))).toBe(false)
  })
  it('rejects credential fields while accepting controlled access statuses', () => {
    const a = emptyStudentLoanIntake()
    a.sections.client[0].fsaLoginReady = 'Needs password reset'
    expect(validateStudentLoanIntake(a)).toEqual([])
    a.sections.client[0].fsaPassword = 'fixture'
    expect(validateStudentLoanIntake(a)).toContain('Client and request: invalid fields.')
  })
})
