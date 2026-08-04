/**
 * SERVER ONLY — validate and normalize Relationship Photo bytes.
 * Strips EXIF/GPS via sharp re-encode. No facial analysis / OCR / AI.
 */

import sharp from 'sharp'

export const RELATIONSHIP_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const RELATIONSHIP_PHOTO_MIN_EDGE = 64
export const RELATIONSHIP_PHOTO_MAX_EDGE = 4096
export const RELATIONSHIP_PHOTO_OUTPUT_MAX_EDGE = 1600

export type NormalizedRelationshipPhoto = {
  buffer: Buffer
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  extension: 'jpg' | 'png' | 'webp'
  width: number
  height: number
  byteSize: number
}

export type NormalizeRelationshipPhotoError = {
  ok: false
  code:
    | 'empty'
    | 'too_large'
    | 'unsupported_type'
    | 'dimensions_invalid'
    | 'decode_failed'
  error: string
}

export type NormalizeRelationshipPhotoResult =
  | ({ ok: true } & NormalizedRelationshipPhoto)
  | NormalizeRelationshipPhotoError

function sniffMime(bytes: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml' | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  const head = bytes.subarray(0, Math.min(256, bytes.length)).toString('utf8').toLowerCase()
  if (head.includes('<svg') || head.includes('<?xml')) return 'image/svg+xml'
  return null
}

/**
 * Validate magic bytes + decode with sharp, strip metadata, normalize orientation,
 * resize, and re-encode. Declared Content-Type is ignored for security.
 */
export async function normalizeRelationshipPhoto(
  input: Buffer,
): Promise<NormalizeRelationshipPhotoResult> {
  if (!input || input.length === 0) {
    return { ok: false, code: 'empty', error: 'No image was provided.' }
  }
  if (input.length > RELATIONSHIP_PHOTO_MAX_BYTES) {
    return { ok: false, code: 'too_large', error: 'Photo must be 5 MB or smaller.' }
  }

  const sniffed = sniffMime(input)
  if (!sniffed || sniffed === 'image/svg+xml') {
    return {
      ok: false,
      code: 'unsupported_type',
      error: 'Use a JPEG, PNG, or WebP photo.',
    }
  }

  try {
    const image = sharp(input, { failOn: 'error', animated: false }).rotate()
    const meta = await image.metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0

    if (
      width < RELATIONSHIP_PHOTO_MIN_EDGE ||
      height < RELATIONSHIP_PHOTO_MIN_EDGE ||
      width > RELATIONSHIP_PHOTO_MAX_EDGE ||
      height > RELATIONSHIP_PHOTO_MAX_EDGE
    ) {
      return {
        ok: false,
        code: 'dimensions_invalid',
        error: 'Photo dimensions are not supported.',
      }
    }

    const normalized = image
      .resize({
        width: RELATIONSHIP_PHOTO_OUTPUT_MAX_EDGE,
        height: RELATIONSHIP_PHOTO_OUTPUT_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })

    const buffer = await normalized.toBuffer({ resolveWithObject: true })
    if (buffer.data.length > RELATIONSHIP_PHOTO_MAX_BYTES) {
      return { ok: false, code: 'too_large', error: 'Photo must be 5 MB or smaller.' }
    }

    return {
      ok: true,
      buffer: buffer.data,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      width: buffer.info.width,
      height: buffer.info.height,
      byteSize: buffer.data.length,
    }
  } catch {
    return {
      ok: false,
      code: 'decode_failed',
      error: 'We couldn’t read that image. Try another photo.',
    }
  }
}
