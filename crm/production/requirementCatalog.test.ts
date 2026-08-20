import { describe, expect, it } from 'vitest'
import {
  FIA_ONLY_REQUIREMENT_CODES,
  LIFE_ONLY_REQUIREMENT_CODES,
  REQUIREMENT_CUSTOM_LABEL_MAX,
  REQUIREMENT_CODE_LABELS,
  UNIVERSAL_REQUIREMENT_CODES,
  requirementCodeEligible,
  requirementCodesForProductLine,
} from './requirementCatalog'
import { validateOtherLabel as viewValidateOtherLabel } from './requirementView'

describe('requirement catalog', () => {
  it('makes universal codes available to Life and FIA', () => {
    for (const code of UNIVERSAL_REQUIREMENT_CODES) {
      expect(requirementCodeEligible(code, 'life_term')).toBe(true)
      expect(requirementCodeEligible(code, 'life_permanent')).toBe(true)
      expect(requirementCodeEligible(code, 'fia')).toBe(true)
    }
  })

  it('blocks Life-only codes on FIA and FIA-only codes on Life', () => {
    for (const code of LIFE_ONLY_REQUIREMENT_CODES) {
      expect(requirementCodeEligible(code, 'life_term')).toBe(true)
      expect(requirementCodeEligible(code, 'fia')).toBe(false)
    }
    for (const code of FIA_ONLY_REQUIREMENT_CODES) {
      expect(requirementCodeEligible(code, 'fia')).toBe(true)
      expect(requirementCodeEligible(code, 'life_term')).toBe(false)
      expect(requirementCodeEligible(code, 'life_permanent')).toBe(false)
    }
    expect(requirementCodesForProductLine('fia')).not.toEqual(
      expect.arrayContaining([...LIFE_ONLY_REQUIREMENT_CODES]),
    )
    expect(requirementCodesForProductLine('life_term')).not.toEqual(
      expect.arrayContaining([...FIA_ONLY_REQUIREMENT_CODES]),
    )
  })

  it('uses the approved human labels', () => {
    expect(REQUIREMENT_CODE_LABELS.signature).toBe('Signature')
    expect(REQUIREMENT_CODE_LABELS.replacement_form).toBe('Replacement form')
    expect(REQUIREMENT_CODE_LABELS.delivery).toBe('Delivery / funding acknowledgement')
    expect(REQUIREMENT_CODE_LABELS.other).toBe('Other')
    expect(REQUIREMENT_CODE_LABELS.paramed_exam).toBe('Paramed exam')
    expect(REQUIREMENT_CODE_LABELS.aps).toBe('APS / medical records')
    expect(REQUIREMENT_CODE_LABELS.illustration).toBe('Illustration')
    expect(REQUIREMENT_CODE_LABELS.initial_premium).toBe('Initial premium')
    expect(REQUIREMENT_CODE_LABELS.suitability).toBe('Suitability review')
    expect(REQUIREMENT_CODE_LABELS.exchange_1035).toBe('1035 / transfer paperwork')
    expect(REQUIREMENT_CODE_LABELS.funds).toBe('Funds')
  })
})

describe('other label validation', () => {
  it('requires a trimmed nonblank label of at most 80 characters', () => {
    expect(viewValidateOtherLabel('')).toBeTruthy()
    expect(viewValidateOtherLabel('   ')).toBeTruthy()
    expect(viewValidateOtherLabel('x'.repeat(REQUIREMENT_CUSTOM_LABEL_MAX + 1))).toBeTruthy()
    expect(viewValidateOtherLabel(' APS packet copy ')).toBeNull()
  })
})
