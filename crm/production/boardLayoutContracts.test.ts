import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BOARD_EXCEPTION_COLUMNS,
  BOARD_INTAKE_COLUMNS,
  BOARD_PIPELINE_COLUMNS,
  getProductionBoardLayout,
} from './boardView'

const here = dirname(fileURLToPath(import.meta.url))
const board = readFileSync(join(here, 'ProductionBoard.tsx'), 'utf8')
const card = readFileSync(join(here, 'ProductionBoardCard.tsx'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThan(-1)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('Production board layout contracts', () => {
  it('lets the board viewport own overflow-x while the track can exceed the viewport', () => {
    expect(board).toContain('crm-production-board-viewport')
    expect(board).toContain('crm-production-board-pipeline')
    expect(board.indexOf('crm-production-board-viewport')).toBeLessThan(
      board.indexOf('crm-production-board-pipeline'),
    )
    const viewport = cssRule(styles, '.crm-production-board-viewport')
    expect(viewport).toContain('overflow-x: auto')
    expect(viewport).toContain('min-width: 0')
    expect(viewport).toContain('max-width: 100%')
    expect(viewport).toContain('-webkit-overflow-scrolling: touch')
    const track = cssRule(
      styles,
      '.crm-production-board-pipeline,\n.crm-production-board-rail-columns',
    )
    expect(track).toContain('width: max-content')
    expect(track).not.toContain('overflow-x: auto')
    expect(track).not.toContain('overflow-x: hidden')
    expect(track).not.toContain('overflow-x: clip')
  })

  it('keeps stage columns at a usable minimum width and does not compress them to the viewport', () => {
    const column = cssRule(styles, '.crm-production-board-column')
    expect(column).toContain('min-width: 240px')
    expect(column).toContain('flex: 0 0 240px')
    expect(column).toContain('width: 240px')
    expect(column).not.toContain('flex: 1')
    expect(board).toContain('model.pipeline.map')
    expect(BOARD_PIPELINE_COLUMNS.map((column) => column.stage)).toEqual([
      'submitted',
      'paramed',
      'in_underwriting',
      'approved',
      'sent_to_draft',
      'premium_drafted',
      'issued',
      'in_force',
    ])
    expect(BOARD_PIPELINE_COLUMNS.map((column) => column.label)).toEqual([
      'Submitted',
      'Paramed',
      'In Underwriting',
      'Approved',
      'Sent to Draft',
      'Drafted',
      'Issued',
      'In Force',
    ])
    expect(BOARD_INTAKE_COLUMNS.map((column) => column.stage)).toEqual(['draft', 'pre_submitted'])
    expect(BOARD_EXCEPTION_COLUMNS.map((column) => column.stage)).toEqual([
      'declined',
      'postponed',
      'withdrawn',
      'incomplete',
      'not_taken',
    ])
  })

  it('contains horizontal overflow in the CRM shell and Production page, not the document', () => {
    expect(cssRule(styles, '.crm-shell')).toContain('overflow-x: clip')
    expect(cssRule(styles, '.crm-main')).toContain('overflow-x: clip')
    expect(cssRule(styles, '.crm-content')).toContain('overflow-x: clip')
    expect(styles).toMatch(/\.crm-production-page \{\s*overflow-x: clip;/)
    expect(cssRule(styles, '.crm-production-board')).toContain('min-width: 0')
    expect(cssRule(styles, '.crm-production-board')).toContain('max-width: 100%')
    expect(cssRule(styles, '.crm-panel')).toContain('min-width: 0')
  })

  it('keeps Board/Table controls outside the horizontally scrolling track', () => {
    expect(queuePage).toContain('crm-production-view-head')
    expect(queuePage).toContain('ProductionViewToggle')
    expect(queuePage.indexOf('<ProductionViewToggle')).toBeLessThan(
      queuePage.indexOf('<ProductionBoard'),
    )
    expect(board).not.toContain('ProductionViewToggle')
    expect(board).not.toContain('crm-production-view-toggle')
  })

  it('does not stretch sparse columns to a fake board height', () => {
    const track = cssRule(
      styles,
      '.crm-production-board-pipeline,\n.crm-production-board-rail-columns',
    )
    const column = cssRule(styles, '.crm-production-board-column')
    const viewport = cssRule(styles, '.crm-production-board-viewport')
    expect(track).toContain('align-items: flex-start')
    expect(column).toContain('align-self: flex-start')
    expect(column).toContain('align-content: start')
    expect(column).toContain('height: max-content')
    expect(column).not.toContain('min-height: 100%')
    expect(column).not.toContain('min-height: 100vh')
    expect(viewport).toContain('overflow-y: visible')
    expect(viewport).not.toContain('min-height: 100vh')
    expect(viewport).not.toContain('height: 100%')
    expect(track).not.toContain('align-items: stretch')
  })

  it('keeps drag listeners on the handle and preserves Move / Edit / Notes surfaces', () => {
    const handleBlockStart = card.indexOf('crm-production-board-drag-handle')
    const listenersAt = card.indexOf('{...listeners}')
    const attributesAt = card.indexOf('{...attributes}')
    expect(handleBlockStart).toBeGreaterThan(-1)
    expect(listenersAt).toBeGreaterThan(handleBlockStart)
    expect(attributesAt).toBeGreaterThan(handleBlockStart)
    expect(card.indexOf('{...listeners}')).toBeGreaterThan(card.indexOf('crm-production-board-card-actions'))
    expect(card).toContain('useDraggable')
    const beforeActions = card.slice(0, card.indexOf('crm-production-board-card-actions'))
    expect(beforeActions).not.toContain('{...listeners}')
    expect(card).toContain('crmProductionPath(item.id)')
    expect(card).toContain('ProductionBoardMoveMenu')
    expect(card).toContain('Edit Application')
    expect(card).toContain('Operational notes for')
    expect(card).toContain('CaseAttentionFlagList')
    expect(card).toContain('className="crm-production-board-drag-handle"')
  })

  it('keeps stacked mobile board swipeable without page-level sideways drift', () => {
    expect(getProductionBoardLayout(393)).toBe('stacked')
    expect(getProductionBoardLayout(768)).toBe('horizontal')
    expect(board).toContain("layout === 'stacked'")
    expect(board).toContain('crm-production-board-tabs')
    const tabs = cssRule(styles, '.crm-production-board-tabs')
    expect(tabs).toContain('overflow-x: auto')
    expect(tabs).toContain('min-width: 0')
    expect(tabs).toContain('max-width: 100%')
    expect(tabs).toContain('overscroll-behavior-x: contain')
    expect(cssRule(styles, '.crm-production-board-viewport')).toContain(
      'overscroll-behavior-x: contain',
    )
    const stackedColumn = cssRule(styles, '.crm-production-board.is-stacked .crm-production-board-column')
    expect(stackedColumn).toContain('width: 100%')
    expect(stackedColumn).toContain('min-width: 0')
  })
})
