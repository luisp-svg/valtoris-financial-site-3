import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BOARD_EXCEPTION_COLUMNS,
  BOARD_INTAKE_COLUMNS,
  BOARD_PIPELINE_COLUMNS,
} from './boardView'

const here = dirname(fileURLToPath(import.meta.url))
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')
const board = readFileSync(join(here, 'ProductionBoard.tsx'), 'utf8')
const card = readFileSync(join(here, 'ProductionBoardCard.tsx'), 'utf8')
const boardView = readFileSync(join(here, 'boardView.ts'), 'utf8')
const migrationsDir = join(here, '../../supabase/migrations')

describe('Phase B.5 board stage color contracts', () => {
  it('reuses centralized board stage mapping and data-stage hooks', () => {
    expect(BOARD_PIPELINE_COLUMNS.map((column) => column.label)).toEqual([
      'Applied',
      'Paramed',
      'In Underwriting',
      'Approved',
      'Sent to Draft',
      'Drafted',
      'Issued',
      'In Force',
    ])
    expect(board).toContain('data-stage={column.stage}')
    expect(card).toContain('data-stage={item.production_stage}')
    expect(boardView).toContain("stage: 'draft', label: 'Application Draft'")
    expect(boardView).toContain("stage: 'premium_drafted', label: 'Drafted'")
    expect(board).toContain('Intake / Application Drafts')
    expect(board).toContain('Exceptions')
    expect(board).not.toContain('transitionPolicyApplicationStage')
  })

  it('applies accent tokens to primary, intake, and exception stages without filling cards', () => {
    for (const column of [
      ...BOARD_PIPELINE_COLUMNS,
      ...BOARD_INTAKE_COLUMNS,
      ...BOARD_EXCEPTION_COLUMNS,
    ]) {
      expect(styles).toContain(`[data-stage='${column.stage}']`)
    }
    expect(styles).toContain('.crm-production-board-column-head h3::before')
    expect(styles).toContain('border-left: 4px solid var(--pp-stage-accent)')
    expect(styles).toContain('border-left: 3px solid var(--pp-stage-accent, var(--crm-border))')
    expect(styles).toContain('.crm-production-board-card {')
    expect(styles).toContain('background: #fff;')
    expect(styles).not.toMatch(
      /\.crm-production-board-card[^{]*\{[^}]*background:\s*#(2563eb|7c3aed|16a34a)/,
    )
  })

  it('does not add Migration 039 or change stage workflow grouping', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))
    expect(files.some((name) => name.includes('039'))).toBe(false)
    expect(existsSync(join(migrationsDir, '039_notes_application_id.sql'))).toBe(false)
    expect(boardView).toContain("if (INTAKE_STAGE_SET.has(stage)) return 'intake'")
    expect(boardView).toContain("stage: 'draft', label: 'Application Draft'")
  })
})
