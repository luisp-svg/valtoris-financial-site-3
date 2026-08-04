import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { normalizeRelationshipPhoto } from './normalizeRelationshipPhoto'

async function makeJpeg(width = 200, height = 200): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 40, b: 80 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe('normalizeRelationshipPhoto', () => {
  it('accepts jpeg and strips to normalized jpeg without preserving originals', async () => {
    const input = await makeJpeg(2000, 1200)
    const result = await normalizeRelationshipPhoto(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.extension).toBe('jpg')
    expect(result.width).toBeLessThanOrEqual(1600)
    expect(result.height).toBeLessThanOrEqual(1600)
    expect(result.byteSize).toBeGreaterThan(0)
  })

  it('rejects SVG-looking payloads', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')
    const result = await normalizeRelationshipPhoto(svg)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('unsupported_type')
  })

  it('rejects oversized buffers before decode work expands', async () => {
    const huge = Buffer.alloc(5 * 1024 * 1024 + 10, 1)
    const result = await normalizeRelationshipPhoto(huge)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('too_large')
  })

  it('rejects tiny dimensions', async () => {
    const tiny = await makeJpeg(32, 32)
    const result = await normalizeRelationshipPhoto(tiny)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('dimensions_invalid')
  })
})
