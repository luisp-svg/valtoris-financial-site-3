import { describe, expect, it } from 'vitest'
import {
  CATALOG_GENERIC_ERROR,
  extractCrmPpCode,
  formatCatalogUserError,
  isCrmPpError,
} from './catalogErrors'

describe('catalog error normalization', () => {
  it('extracts CRM_PP codes from PostgREST-shaped errors', () => {
    expect(extractCrmPpCode({ message: 'CRM_PP:invalid_payload' })).toBe('invalid_payload')
    expect(extractCrmPpCode({ details: 'CRM_PP:not_authorized' })).toBe('not_authorized')
    expect(extractCrmPpCode({ hint: 'CRM_PP:catalog_inactive' })).toBe('catalog_inactive')
    expect(extractCrmPpCode('CRM_PP:missing_required_fields')).toBe('missing_required_fields')
  })

  it('maps known codes to safe copy and never leaks raw postgres text', () => {
    expect(formatCatalogUserError({ message: 'CRM_PP:invalid_payload' })).toMatch(/duplicates/i)
    expect(formatCatalogUserError({ message: 'CRM_PP:not_authorized' })).toMatch(/permission/i)
    expect(formatCatalogUserError({ message: 'CRM_PP:catalog_inactive' })).toMatch(/active carrier/i)
    expect(formatCatalogUserError({ message: 'CRM_PP:not_found' })).toMatch(/not found/i)
    const leaked = formatCatalogUserError({
      message: 'permission denied for table carriers (42501)',
      details: 'SQLSTATE 42501',
    })
    expect(leaked).toBe(CATALOG_GENERIC_ERROR)
    expect(leaked).not.toMatch(/42501|permission denied|SQLSTATE|PGRST/i)
  })

  it('detects CRM_PP errors', () => {
    expect(isCrmPpError({ message: 'CRM_PP:not_authenticated' })).toBe(true)
    expect(isCrmPpError({ message: 'jwt expired' })).toBe(false)
  })
})
