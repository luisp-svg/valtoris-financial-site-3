/**
 * Browser helpers for optional Relationship Photo capture.
 * Client resize is an optimization — server still validates/normalizes.
 */

export type RelationshipPhotoClientAvailability =
  | {
      available: true
      uploadToken: string
      expiresAt: string
    }
  | {
      available: false
    }

export type PreparedRelationshipPhoto = {
  blob: Blob
  dataUrl: string
  mimeType: 'image/jpeg'
  byteSize: number
}

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.8

export function relationshipPhotoCopy() {
  return {
    entryLabel: 'Add a photo from where we met',
    title: 'Add a photo from where we met',
    body: 'Take a selfie together so I can remember where we met.',
    softBody: 'Optional: add a quick photo so I remember our conversation.',
    disclosure:
      'This photo is optional. If you add one, it is stored in our private CRM so your advisor can remember this conversation. It is not used for facial recognition or biometric identification, is not shown on your public card or client portal by default, and can be removed on request subject to our retention practices.',
    acknowledgment:
      'I understand this optional photo will be stored in the CRM to help my advisor remember our meeting and will not be used for facial recognition.',
    takeSelfie: 'Take Selfie',
    uploadPhoto: 'Upload Photo',
    skip: 'Skip',
    retake: 'Retake',
    remove: 'Remove',
    savePhoto: 'Save Photo',
    saving: 'Saving photo…',
    success: 'Photo saved. Thanks — this helps me remember where we met.',
    failure:
      'We couldn’t save the photo. Your connection was already saved — you can try again or skip.',
    unavailable: 'Photo upload is unavailable right now. Your connection is still saved.',
  }
}

export async function prepareRelationshipPhotoFile(
  file: File,
): Promise<PreparedRelationshipPhoto> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('canvas_unavailable')
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (!value) reject(new Error('encode_failed'))
          else resolve(value)
        },
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
    const dataUrl = await blobToDataUrl(blob)
    return {
      blob,
      dataUrl,
      mimeType: 'image/jpeg',
      byteSize: blob.size,
    }
  } finally {
    bitmap.close()
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('read_failed'))
    }
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(blob)
  })
}

export async function submitRelationshipPhoto(input: {
  uploadToken: string
  photoAcknowledgment: boolean
  imageBase64: string
  fetchImpl?: typeof fetch
  endpoint?: string
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const fetchImpl = input.fetchImpl ?? fetch
  const endpoint = input.endpoint ?? '/api/digital-identity/relationship-photo'

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadToken: input.uploadToken,
        photoAcknowledgment: input.photoAcknowledgment,
        imageBase64: input.imageBase64,
        source: 'digital_identity_connect',
      }),
    })
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      code?: string
    }
    if (!response.ok || json.ok !== true) {
      return {
        ok: false,
        error:
          typeof json.error === 'string' && json.error
            ? json.error
            : 'Unable to save photo. Your connection is still saved.',
        code: typeof json.code === 'string' ? json.code : undefined,
      }
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'Unable to save photo. Your connection is still saved.',
      code: 'network',
    }
  }
}
