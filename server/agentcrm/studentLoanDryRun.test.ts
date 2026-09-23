import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { runStudentLoanAgentCrmDryRun, type StudentLoanDryRunInput } from './studentLoanDryRun'

const INPUT: StudentLoanDryRunInput = {
  assessmentType: 'student_loan',
  matchStatus: 'new_prospect',
  memberId: 'member-1',
  submissionId: '550e8400-e29b-41d4-a716-446655440004',
  firstName: 'Jamie',
  lastName: 'Rivera',
  email: 'jamie.rivera@example.com',
  phone: '+15552014488',
}

describe('runStudentLoanAgentCrmDryRun', () => {
  it('maps an exact classifier result without keeping the external contact id', async () => {
    const lookupIdentity = vi.fn(async () => ({
      status: 'EXACT_EXISTING_CONTACT' as const,
      externalContactId: 'do-not-keep-contact-id',
    }))
    const decision = await runStudentLoanAgentCrmDryRun(INPUT, { lookupIdentity, log: () => {} })
    expect(decision).toEqual({ status: 'EXACT_EXISTING_CONTACT' })
    expect(JSON.stringify(decision)).not.toContain('do-not-keep-contact-id')
    expect(lookupIdentity).toHaveBeenCalledTimes(1)
  })

  it('maps no contact found', async () => {
    const lookupIdentity = vi.fn(async () => ({ status: 'NO_CONTACT_FOUND' as const }))
    const decision = await runStudentLoanAgentCrmDryRun(INPUT, { lookupIdentity, log: () => {} })
    expect(decision).toEqual({ status: 'NO_CONTACT_FOUND' })
  })

  it('maps an exact result for exact_trusted_match', async () => {
    const lookupIdentity = vi.fn(async () => ({
      status: 'EXACT_EXISTING_CONTACT' as const,
      externalContactId: 'hidden-id',
    }))
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, matchStatus: 'exact_trusted_match' },
      { lookupIdentity, log: () => {} },
    )
    expect(decision).toEqual({ status: 'EXACT_EXISTING_CONTACT' })
    expect(lookupIdentity).toHaveBeenCalledTimes(1)
  })

  it('skips possible_match without calling the classifier', async () => {
    const lookupIdentity = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, matchStatus: 'possible_match' },
      { lookupIdentity, log: () => {} },
    )
    expect(decision).toEqual({ status: 'SKIP_POSSIBLE_MATCH' })
    expect(lookupIdentity).not.toHaveBeenCalled()
  })

  it('skips a null member id without calling the classifier', async () => {
    const lookupIdentity = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, memberId: null },
      { lookupIdentity, log: () => {} },
    )
    expect(decision).toEqual({ status: 'SKIP_REPLAY_WITHOUT_MEMBER' })
    expect(lookupIdentity).not.toHaveBeenCalled()
  })

  it('maps an ambiguous classifier result', async () => {
    const lookupIdentity = vi.fn(async () => ({ status: 'AMBIGUOUS' as const, reason: 'EMAIL_ONLY_MATCH' as const }))
    const decision = await runStudentLoanAgentCrmDryRun(INPUT, { lookupIdentity, log: () => {} })
    expect(decision).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
  })

  it('maps an integration error and a thrown timeout without leaking the candidate', async () => {
    const lookupIdentity = vi.fn(async () => ({ status: 'INTEGRATION_ERROR' as const, category: 'timeout' as const }))
    const decision = await runStudentLoanAgentCrmDryRun(INPUT, { lookupIdentity, log: () => {} })
    expect(decision).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })

    const throwing = vi.fn(async () => {
      throw new Error(`timeout for ${INPUT.email}`)
    })
    const thrown = await runStudentLoanAgentCrmDryRun(INPUT, { lookupIdentity: throwing, log: () => {} })
    expect(thrown).toEqual({ status: 'INTEGRATION_ERROR', category: 'network' })
    expect(JSON.stringify(thrown)).not.toContain(INPUT.email)
  })

  it('does not call the classifier for a non-student-loan report card', async () => {
    const lookupIdentity = vi.fn()
    const decision = await runStudentLoanAgentCrmDryRun(
      { ...INPUT, assessmentType: 'credit' },
      { lookupIdentity, log: () => {} },
    )
    expect(decision).toBeNull()
    expect(lookupIdentity).not.toHaveBeenCalled()
  })

  it('logs only the sanitized decision', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await runStudentLoanAgentCrmDryRun(INPUT, {
      lookupIdentity: async () => ({ status: 'NO_CONTACT_FOUND' }),
    })
    expect(info).toHaveBeenCalledTimes(1)
    const payload = JSON.stringify(info.mock.calls[0])
    expect(payload).toContain('NO_CONTACT_FOUND')
    expect(payload).toContain(INPUT.submissionId)
    expect(payload).not.toContain(INPUT.email)
    expect(payload).not.toContain(INPUT.phone)
    expect(payload).not.toContain(INPUT.firstName)
    expect(payload).not.toContain('member-1')
    info.mockRestore()
  })

  it('does not write integration links or add an AgentCRM write method', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/agentcrm/studentLoanDryRun.ts'), 'utf8')
    const ingest = readFileSync(
      resolve(process.cwd(), 'server/ingest/familyReportCard/ingestFamilyReportCard.ts'),
      'utf8',
    )
    expect(source).not.toContain('integration_contact_links')
    expect(ingest).not.toContain('integration_contact_links')
    expect(source).not.toMatch(/method:\s*['"]POST['"]|method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
  })
})
