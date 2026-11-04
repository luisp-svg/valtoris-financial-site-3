import inventory from '../../supabase/migrations/source-inventory.json'

/** Source allowlist only: it does not attest that any migration is deployed. */
export const EXPECTED_MIGRATION_FILES = Object.keys(inventory.sha256).sort()
export const EXPECTED_MIGRATION_HASHES: Readonly<Record<string, string>> = inventory.sha256

export function migrationInventoryIssues(
  actual: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>> = EXPECTED_MIGRATION_HASHES,
): string[] {
  const issues: string[] = []
  for (const file of Object.keys(actual).sort()) {
    if (!Object.prototype.hasOwnProperty.call(expected, file)) issues.push(`Unexpected migration: ${file}`)
    else if (actual[file] !== expected[file]) issues.push(`Modified migration: ${file}`)
  }
  for (const file of Object.keys(expected).sort()) {
    if (!Object.prototype.hasOwnProperty.call(actual, file)) issues.push(`Missing migration: ${file}`)
  }
  return issues
}
