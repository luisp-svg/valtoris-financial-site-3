import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXPECTED_MIGRATION_FILES, migrationInventoryIssues } from './helpers/migrationInventory'

describe('versioned migration source inventory', () => {
  it('requires exact reviewed filenames and unchanged SQL bytes', () => {
    const directory = resolve(process.cwd(), 'supabase/migrations')
    const files = readdirSync(directory).filter(name => name.endsWith('.sql')).sort()
    expect(files).toEqual(EXPECTED_MIGRATION_FILES)
    const actual = Object.fromEntries(files.map(name => [name,
      createHash('sha256').update(readFileSync(resolve(directory, name))).digest('hex')]))
    expect(migrationInventoryIssues(actual)).toEqual([])
  })
  it('rejects an unregistered addition even when the total count stays the same', () => {
    expect(migrationInventoryIssues({ 'unexpected.sql': 'abc' }, { 'known.sql': 'abc' }))
      .toEqual(['Unexpected migration: unexpected.sql', 'Missing migration: known.sql'])
  })
  it('detects edits to historical SQL and removed migrations', () => {
    expect(migrationInventoryIssues({ 'known.sql': 'modified' }, { 'known.sql': 'original', 'removed.sql': 'def' }))
      .toEqual(['Modified migration: known.sql', 'Missing migration: removed.sql'])
  })
})
