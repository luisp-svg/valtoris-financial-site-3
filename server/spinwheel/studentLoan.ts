import { randomUUID } from 'node:crypto'

const SANDBOX_ORIGIN = 'https://sandbox-api.spinwheel.io'

type JsonObject = Record<string, unknown>

export type SpinwheelStudentLoanSummary = {
  totalOutstandingBalance: number | null
  loanCount: number
  loanStatuses: string[]
  servicers: string[]
  loanTypes: string[]
  identity: {
    fullName: string | null
    maskedPhone: string | null
  }
}

export type SpinwheelNormalizedError = {
  httpStatus: number
  code: string
  message: string
  retryable: boolean
}

export class SpinwheelRequestError extends Error {
  readonly normalized: SpinwheelNormalizedError

  constructor(normalized: SpinwheelNormalizedError) {
    super(normalized.message)
    this.name = 'SpinwheelRequestError'
    this.normalized = normalized
  }
}

function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function nestedString(...values: unknown[]): string | null {
  for (const value of values) {
    const candidate = string(value)
    if (candidate) return candidate
  }
  return null
}

function maskedPhone(value: unknown): string | null {
  const digits = string(value)?.replace(/\D/g, '') ?? ''
  if (digits.length < 4) return null
  return `•••-•••-${digits.slice(-4)}`
}

function liabilityBalance(liability: JsonObject): number | null {
  const balances = object(liability.balanceDetails)
  return number(
    balances?.outstandingBalance
      ?? balances?.principalBalance
      ?? balances?.statementBalance
      ?? liability.outstandingBalance,
  )
}

function normalizeError(payload: unknown, httpStatus: number): SpinwheelNormalizedError {
  const root = object(payload)
  const status = object(root?.status)
  const messages = Array.isArray(status?.messages) ? status.messages : []
  const firstMessage = messages.map(object).map((item) => string(item?.desc)).find(Boolean)
  const apiCode = string(status?.code) ?? (typeof status?.code === 'number' ? String(status.code) : null)
  const apiDescription = string(status?.desc)
  const unsafeMessage = firstMessage ?? apiDescription ?? 'Unable to complete the secure loan connection. Please try again.'
  const message = unsafeMessage
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[redacted]')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[redacted]')
    .replace(/\+?1?\d{10}\b/g, '[redacted]')
    .replace(/\b\d{6}\b/g, '[redacted]')
    .slice(0, 240)
  return {
    httpStatus,
    code: apiCode ?? (httpStatus === 429 ? 'RATE_LIMITED' : 'SPINWHEEL_REQUEST_FAILED'),
    message,
    retryable: httpStatus === 429 || httpStatus >= 500,
  }
}

function sandboxBaseUrl(): string {
  const configured = (process.env.SPINWHEEL_API_BASE_URL || SANDBOX_ORIGIN).replace(/\/$/, '')
  const url = new URL(configured)
  if (url.origin !== SANDBOX_ORIGIN) {
    throw new Error('Spinwheel sandbox base URL is invalid')
  }
  return url.pathname === '/v1' ? configured : `${url.origin}/v1`
}

async function spinwheelFetch(path: string, body: JsonObject): Promise<JsonObject> {
  const apiKey = process.env.SPINWHEEL_SECRET_KEY
  if (!apiKey) throw new Error('Spinwheel sandbox is not configured')

  const response = await fetch(`${sandboxBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // The normalized fallback below intentionally excludes raw upstream content.
  }

  if (!response.ok) throw new SpinwheelRequestError(normalizeError(payload, response.status))
  const parsed = object(payload)
  if (!parsed) {
    throw new SpinwheelRequestError({
      httpStatus: 502,
      code: 'INVALID_UPSTREAM_RESPONSE',
      message: 'The loan connection returned an unreadable response. Please try again.',
      retryable: true,
    })
  }
  return parsed
}

export async function connectStudentLoanUser(input: {
  phoneNumber: string
  dateOfBirth: string
  consentTimestamp: string
}): Promise<{ userId: string; codeExpiresAt: string | null; codeTimeoutSeconds: number | null }> {
  const payload = await spinwheelFetch('/users/connect/sms', {
    extUserId: randomUUID(),
    phoneNumber: input.phoneNumber,
    dateOfBirth: input.dateOfBirth,
    audit: { consentTimestamp: input.consentTimestamp },
  })
  const data = object(payload.data) ?? payload
  const sms = object(data.sms)
  const userId = string(data.userId)
  if (!userId) {
    throw new SpinwheelRequestError({
      httpStatus: 502,
      code: 'MISSING_USER_ID',
      message: 'The loan connection could not be started. Please try again.',
      retryable: true,
    })
  }
  return {
    userId,
    codeExpiresAt: string(sms?.codeExpiresAt),
    codeTimeoutSeconds: number(sms?.codeTimeoutSeconds),
  }
}

export function normalizeStudentLoanProfile(
  profilePayload: unknown,
  verifyPayload?: unknown,
): SpinwheelStudentLoanSummary {
  const root = object(profilePayload)
  const data = object(root?.data) ?? root ?? {}
  const loans = Array.isArray(data.studentLoans)
    ? data.studentLoans.map(object).filter((loan): loan is JsonObject => Boolean(loan))
    : []

  const balances = loans.map(liabilityBalance).filter((value): value is number => value !== null)
  const summary = object(data.studentLoanSummary)
  const summaryBalance = number(
    summary?.totalOutstandingBalance ?? summary?.outstandingBalance ?? summary?.totalBalance,
  )
  const totalOutstandingBalance = balances.length > 0
    ? Math.round(balances.reduce((sum, value) => sum + value, 0) * 100) / 100
    : summaryBalance

  const verifyRoot = object(verifyPayload)
  const verifyData = object(verifyRoot?.data) ?? verifyRoot
  const profile = object(verifyData?.profile)
  const fullName = unique([string(profile?.firstName), string(profile?.middleName), string(profile?.lastName)]).join(' ')

  return {
    totalOutstandingBalance,
    loanCount: loans.length,
    loanStatuses: unique(loans.map((loan) => {
      const liabilityProfile = object(loan.liabilityProfile)
      return nestedString(liabilityProfile?.status, loan.status, liabilityProfile?.accountRating)
    })),
    servicers: unique(loans.map((loan) => {
      const creditor = object(loan.creditor)
      const liabilityProfile = object(loan.liabilityProfile)
      return nestedString(creditor?.name, creditor?.displayName, liabilityProfile?.displayName)
    })),
    loanTypes: unique(loans.map((loan) => {
      const liabilityProfile = object(loan.liabilityProfile)
      return nestedString(loan.loanType, liabilityProfile?.loanType, liabilityProfile?.subtype)
    })),
    identity: {
      fullName: fullName || null,
      maskedPhone: maskedPhone(profile?.phoneNumber),
    },
  }
}

export async function verifyAndFetchStudentLoans(input: {
  userId: string
  code: string
}): Promise<SpinwheelStudentLoanSummary> {
  const encodedUserId = encodeURIComponent(input.userId)
  const verifyPayload = await spinwheelFetch(`/users/${encodedUserId}/connect/sms/verify`, {
    code: input.code,
  })
  const profilePayload = await spinwheelFetch(
    `/users/${encodedUserId}/debtProfile?liabilityType=STUDENT_LOAN`,
    {
      creditReport: { type: '1_BUREAU.FULL' },
      creditScore: { model: 'VANTAGE_SCORE_3_0' },
    },
  )
  return normalizeStudentLoanProfile(profilePayload, verifyPayload)
}
