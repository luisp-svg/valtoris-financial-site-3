function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * SHA-256 of the exact selected file bytes. Lowercase 64-char hex.
 * Does not hash a reconstructed filename or re-serialized CSV text.
 */
export async function sha256HexFromBytes(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(new Uint8Array(digest))
}

export function isCommissionImportSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value)
}
