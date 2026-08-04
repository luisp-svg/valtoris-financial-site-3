import { describe, expect, it } from 'vitest'
import {
  getDocumentTypeDefinition,
  isMimeTypeAllowed,
  listOptionalDocumentsForModule,
} from './index'

describe('Document Engine relationship_photo', () => {
  const definition = getDocumentTypeDefinition('relationship_photo')

  it('registers Relationship Photo as optional private memory-aid metadata', () => {
    expect(definition).toBeDefined()
    expect(definition?.title).toBe('Relationship Photo')
    expect(definition?.required).toBe(false)
    expect(definition?.allowMultiple).toBe(false)
    expect(definition?.category).toBe('client_generated')
    expect(definition?.moduleKey).toBe('digital_identity')
    expect(definition?.caseType).toBeNull()
    expect(definition?.visibility).toBe('internal')
    expect(definition?.review.reviewRequired).toBe(false)
    expect(definition?.retentionPolicy).toBe('engagement')
    expect(definition?.maxSizeMB).toBe(5)
    expect(definition?.aiExtractionHints).toEqual([])
    expect(definition?.workflowDependencies).toEqual([])
    expect(definition?.description).toMatch(/must not be used for facial recognition/i)
    expect(definition?.description).toMatch(/biometric/i)
    expect(definition?.description).not.toMatch(/\bOCR\b/i)
  })

  it('allows only jpeg/png/webp and rejects SVG', () => {
    expect(definition?.supportedMimeTypes).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
    expect(isMimeTypeAllowed('relationship_photo', 'image/jpeg')).toBe(true)
    expect(isMimeTypeAllowed('relationship_photo', 'image/png')).toBe(true)
    expect(isMimeTypeAllowed('relationship_photo', 'image/webp')).toBe(true)
    expect(isMimeTypeAllowed('relationship_photo', 'image/svg+xml')).toBe(false)
    expect(isMimeTypeAllowed('relationship_photo', 'application/pdf')).toBe(false)
  })

  it('lists as optional for digital_identity module', () => {
    const optional = listOptionalDocumentsForModule('digital_identity')
    expect(optional.some((item) => item.key === 'relationship_photo')).toBe(true)
    expect(optional.find((item) => item.key === 'relationship_photo')?.required).toBe(false)
  })
})
