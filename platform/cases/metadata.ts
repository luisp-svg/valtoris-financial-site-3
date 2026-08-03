/**
 * Case metadata helpers — allow-listed keys only on draft creation.
 */

import type { CaseEngineMetadata, CreateCaseDraftInput } from './types'

export const CASE_PUBLISH_METADATA_ALLOWLIST = [
  'idempotencyKey',
  'source',
  'captureChannel',
  'assessmentType',
  'workflowHint',
  'aiSummaryRef',
  'portalVisible',
] as const

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

export function buildCaseMetadata(
  input: CreateCaseDraftInput['metadata'] | undefined,
): CaseEngineMetadata {
  const raw = asRecord(input)
  const metadata: CaseEngineMetadata = {}

  for (const key of CASE_PUBLISH_METADATA_ALLOWLIST) {
    if (raw[key] === undefined) continue
    const value = raw[key]
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      metadata[key] = value
    }
  }

  return metadata
}
