import { isExperiorImportIdempotencyKey, isManualCommissionIdempotencyKey } from './commissionIdempotency'
import type { WritingCommissionEvent } from '../production/compensationView'

export function formatCommissionEventSourceLabel(
  event: Pick<
    WritingCommissionEvent,
    | 'import_batch_identifier'
    | 'idempotency_key'
    | 'statement_identifier'
    | 'policy_reference'
    | 'source_file'
    | 'source_row'
  >,
): string {
  if (event.import_batch_identifier || isExperiorImportIdempotencyKey(event.idempotency_key)) {
    return event.import_batch_identifier
      ? `Experior Import ${event.import_batch_identifier}`
      : 'Experior Import'
  }

  const details = [
    event.statement_identifier ? `Statement ${event.statement_identifier}` : null,
    event.policy_reference ? `Policy ${event.policy_reference}` : null,
    event.source_file ? event.source_file : null,
    event.source_row != null ? `Row ${event.source_row}` : null,
  ].filter((part): part is string => Boolean(part))

  if (isManualCommissionIdempotencyKey(event.idempotency_key)) {
    return details.length > 0 ? `Manual entry · ${details.join(' · ')}` : 'Manual entry'
  }
  if (details.length > 0) return details.join(' · ')
  return 'No source reference'
}
