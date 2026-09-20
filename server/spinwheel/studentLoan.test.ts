import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  connectStudentLoanUser,
  normalizeStudentLoanProfile,
  verifyAndFetchStudentLoans,
} from './studentLoan'

const originalKey = process.env.SPINWHEEL_SECRET_KEY
const originalBase = process.env.SPINWHEEL_API_BASE_URL

beforeEach(() => {
  process.env.SPINWHEEL_SECRET_KEY = 'sandbox-test-key'
  process.env.SPINWHEEL_API_BASE_URL = 'https://sandbox-api.spinwheel.io'
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalKey === undefined) delete process.env.SPINWHEEL_SECRET_KEY
  else process.env.SPINWHEEL_SECRET_KEY = originalKey
  if (originalBase === undefined) delete process.env.SPINWHEEL_API_BASE_URL
  else process.env.SPINWHEEL_API_BASE_URL = originalBase
})

describe('Spinwheel Student Loan normalization', () => {
  it('returns only the minimum consultation summary from student liabilities', () => {
    const result = normalizeStudentLoanProfile(
      {
        data: {
          studentLoans: [
            {
              loanType: 'DIRECT SUBSIDIZED',
              liabilityProfile: { status: 'REPAYMENT', displayName: 'Federal Loan' },
              balanceDetails: { outstandingBalance: 12500.25 },
              creditor: { name: 'MOHELA' },
              accountNumber: 'must-not-be-returned',
            },
            {
              loanType: 'DIRECT UNSUBSIDIZED',
              liabilityProfile: { status: 'DEFERMENT' },
              balanceDetails: { principalBalance: '7,499.75' },
              creditor: { name: 'MOHELA' },
            },
          ],
          creditReports: [{ profile: { ssn: '6789' } }],
        },
      },
      {
        data: {
          profile: {
            firstName: 'Alex',
            lastName: 'Rivera',
            phoneNumber: '+15551234567',
            ssnLastFourDigits: '6789',
            dateOfBirth: '1980-01-01',
          },
        },
      },
    )

    expect(result).toEqual({
      totalOutstandingBalance: 20000,
      loanCount: 2,
      loanStatuses: ['REPAYMENT', 'DEFERMENT'],
      servicers: ['MOHELA'],
      loanTypes: ['DIRECT SUBSIDIZED', 'DIRECT UNSUBSIDIZED'],
      identity: { fullName: 'Alex Rivera', maskedPhone: '•••-•••-4567' },
    })
    expect(JSON.stringify(result)).not.toMatch(/6789|1980-01-01|accountNumber/)
  })

  it('uses the summary balance when individual balances are missing', () => {
    expect(normalizeStudentLoanProfile({
      data: {
        studentLoans: [{}],
        studentLoanSummary: { totalOutstandingBalance: '$42,100' },
      },
    }).totalOutstandingBalance).toBe(42100)
  })

  it('keeps the API key server-side and sends the consent timestamp in audit metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { userId: 'user-12345678', sms: { codeTimeoutSeconds: 300 } },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectStudentLoanUser({
      phoneNumber: '+15551234567',
      dateOfBirth: '1980-01-01',
      consentTimestamp: '2026-09-20T20:00:00.000Z',
    })

    expect(result.userId).toBe('user-12345678')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://sandbox-api.spinwheel.io/v1/users/connect/sms')
    expect(options.headers).toMatchObject({ Authorization: 'Bearer sandbox-test-key' })
    expect(JSON.parse(String(options.body))).toMatchObject({
      phoneNumber: '+15551234567',
      dateOfBirth: '1980-01-01',
      audit: { consentTimestamp: '2026-09-20T20:00:00.000Z' },
    })
  })

  it('verifies the code and fetches only the student-loan debt profile', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { profile: { firstName: 'Alex' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { studentLoans: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await verifyAndFetchStudentLoans({ userId: 'user-12345678', code: '123456' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://sandbox-api.spinwheel.io/v1/users/user-12345678/connect/sms/verify',
      expect.objectContaining({ body: JSON.stringify({ code: '123456' }) }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://sandbox-api.spinwheel.io/v1/users/user-12345678/debtProfile?liabilityType=STUDENT_LOAN',
      expect.objectContaining({
        body: JSON.stringify({
          creditReport: { type: '1_BUREAU.FULL' },
          creditScore: { model: 'VANTAGE_SCORE_3_0' },
        }),
      }),
    )
  })
})
