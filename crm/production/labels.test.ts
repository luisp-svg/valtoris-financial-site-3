import { describe, expect, it } from 'vitest'
import {
  formatCatalogProductLineLabel,
  formatProductionDeliveryLabel,
  formatProductionDispositionLabel,
  formatProductionEntryStageLabel,
  formatProductionParticipantRoleLabel,
  formatProductionPremiumModeLabel,
  formatProductionProductLineLabel,
  formatProductionProductLineShort,
  formatProductionStageLabel,
} from './labels'

describe('production labels', () => {
  it('maps stages, product lines, dispositions, delivery, and roles', () => {
    expect(formatProductionStageLabel('in_underwriting')).toBe('In underwriting')
    expect(formatProductionStageLabel('in_force')).toBe('In force')
    expect(formatProductionProductLineLabel('life_permanent')).toBe('Life — Permanent / IUL')
    expect(formatCatalogProductLineLabel('life_term')).toBe('Term Life')
    expect(formatCatalogProductLineLabel('life_permanent')).toBe('Permanent Life / IUL')
    expect(formatCatalogProductLineLabel('fia')).toBe('Fixed Indexed Annuity')
    expect(formatProductionProductLineShort('life_permanent')).toBe('IUL / Permanent')
    expect(formatProductionProductLineShort('fia')).toBe('FIA')
    expect(formatProductionDispositionLabel('approved_as_applied')).toBe('Approved as applied')
    expect(formatProductionDeliveryLabel('requirements_pending')).toBe('Requirements pending')
    expect(formatProductionParticipantRoleLabel('annuitant')).toBe('Annuitant')
    expect(formatProductionPremiumModeLabel('semi_annual')).toBe('Semi-annual')
    expect(formatProductionEntryStageLabel('in_underwriting')).toBe('In underwriting')
  })

  it('falls back safely for unknown or empty values', () => {
    expect(formatProductionStageLabel(null)).toBe('—')
    expect(formatProductionStageLabel('custom_stage')).toBe('custom_stage')
    expect(formatProductionProductLineLabel(undefined)).toBe('—')
  })
})
