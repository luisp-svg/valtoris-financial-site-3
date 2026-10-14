import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadHouseholdDocument, validateQuoteFile, MAX_DOCUMENT_BYTES } from './documentsApi'
const pdf = { name: 'declarations.pdf', size: 12, type: 'application/pdf', slice: () => new Blob(['%PDF-']) } as File
function mockClient(metadataError: unknown = null, uploadError: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error: metadataError })
  const eq = vi.fn(); const result = { eq }; eq.mockReturnValueOnce(result).mockResolvedValue({ error: null })
  const update = vi.fn(() => result)
  const upload = vi.fn().mockResolvedValue({ error: uploadError })
  return { insert, update, upload, client: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user' } }, error: null }) }, from: vi.fn(() => ({ insert, update })), storage: { from: vi.fn(() => ({ upload })) } } as unknown as SupabaseClient }
}
describe('quote document uploads', () => {
  it('rejects non-PDF, empty and oversized files before writing', () => {
    for (const file of [{ ...pdf, name: 'a.html' }, { ...pdf, size: 0 }, { ...pdf, size: MAX_DOCUMENT_BYTES + 1 }]) expect(() => validateQuoteFile(file)).toThrow()
  })
  it('does not upload bytes when metadata authorization fails', async () => {
    const fake = mockClient(new Error('denied'))
    await expect(uploadHouseholdDocument(fake.client, 'hh', pdf, 'pc_quote_auto')).rejects.toThrow('denied')
    expect(fake.upload).not.toHaveBeenCalled()
  })
  it('keeps files private and prevents replacements', async () => {
    const fake = mockClient()
    await uploadHouseholdDocument(fake.client, 'hh', pdf, 'pc_quote_home')
    expect(fake.insert).toHaveBeenCalledWith(expect.objectContaining({ household_id: 'hh', visibility: 'advisor_only', doc_type: 'pc_quote_home' }))
    expect(fake.upload).toHaveBeenCalledWith(expect.any(String), pdf, { contentType: 'application/pdf', upsert: false })
  })
  it('clears pending metadata after a failed storage upload', async () => {
    const fake = mockClient(null, new Error('storage failed'))
    await expect(uploadHouseholdDocument(fake.client, 'hh', pdf, 'pc_quote_auto')).rejects.toThrow('storage failed')
    expect(fake.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
  })
})
