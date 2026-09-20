import type { StudentLoanVerificationAnswers } from './types.js'

type ApiError = {
  code?: string
  message?: string
  retryable?: boolean
}

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error?: ApiError }

export class StudentLoanConnectError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(error?: ApiError) {
    super(error?.message || 'Secure loan connection is temporarily unavailable.')
    this.name = 'StudentLoanConnectError'
    this.code = error?.code || 'CONNECTION_FAILED'
    this.retryable = Boolean(error?.retryable)
  }
}

function normalizeUsPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/spinwheel-student-loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  let payload: ApiResponse<T> | null = null
  try {
    payload = await response.json() as ApiResponse<T>
  } catch {
    // A safe generic message is used below.
  }
  if (!response.ok || !payload?.ok) {
    throw new StudentLoanConnectError(payload && !payload.ok ? payload.error : undefined)
  }
  return payload.data
}

export async function startStudentLoanConnection(input: {
  phone: string
  dateOfBirth: string
}): Promise<{ userId: string; codeExpiresAt: string | null; codeTimeoutSeconds: number | null }> {
  const phoneNumber = normalizeUsPhone(input.phone)
  if (!phoneNumber) throw new StudentLoanConnectError({ code: 'INVALID_PHONE', message: 'Enter a valid U.S. mobile number.' })
  return request({
    action: 'connect',
    phoneNumber,
    dateOfBirth: input.dateOfBirth,
    consentTimestamp: new Date().toISOString(),
  })
}

export async function verifyStudentLoanConnection(input: {
  userId: string
  code: string
}): Promise<StudentLoanVerificationAnswers & { identity: { fullName: string | null; maskedPhone: string | null } }> {
  const data = await request<{
    totalOutstandingBalance: number | null
    loanCount: number
    loanStatuses: string[]
    servicers: string[]
    loanTypes: string[]
    identity: { fullName: string | null; maskedPhone: string | null }
  }>({ action: 'verify', userId: input.userId, code: input.code })
  return {
    source: 'spinwheel_sandbox',
    status: 'verified',
    totalOutstandingBalance: data.totalOutstandingBalance,
    loanCount: data.loanCount,
    loanStatuses: data.loanStatuses,
    servicers: data.servicers,
    loanTypes: data.loanTypes,
    identity: data.identity,
  }
}
