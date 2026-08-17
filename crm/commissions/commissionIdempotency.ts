/**
 * Caller-supplied 035 money-posting keys.
 * Server never generates random UUIDs for standalone posts.
 * Namespace must never collide with 036 import keys (`036:`) or reverse defaults (`reverse:`).
 */
export const MANUAL_COMMISSION_IDEMPOTENCY_PREFIX = 'manual035:'
export const EXPERIOR_IMPORT_IDEMPOTENCY_PREFIX = '036:'
export const REVERSAL_IDEMPOTENCY_PREFIX = 'reverse:'

export function createManualCommissionIdempotencyKey(
  createUuid: () => string = () => crypto.randomUUID(),
): string {
  const uuid = createUuid().trim()
  if (!uuid) {
    throw new Error('Commission idempotency UUID was empty')
  }
  return `${MANUAL_COMMISSION_IDEMPOTENCY_PREFIX}${uuid}`
}

export function isManualCommissionIdempotencyKey(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(MANUAL_COMMISSION_IDEMPOTENCY_PREFIX)
}

export function isExperiorImportIdempotencyKey(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(EXPERIOR_IMPORT_IDEMPOTENCY_PREFIX)
}
