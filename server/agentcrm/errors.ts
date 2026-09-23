export type LeadConnectorErrorCategory =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'upstream'
  | 'http'
  | 'invalid_response'

/**
 * Sanitized LeadConnector failure.
 * The message never includes response bodies, contact fields, or credentials.
 */
export class LeadConnectorError extends Error {
  readonly category: LeadConnectorErrorCategory
  readonly status: number | null

  constructor(category: LeadConnectorErrorCategory, status: number | null = null) {
    const statusLabel = status == null ? '' : ` ${status}`
    super(`LeadConnector request failed (${category}${statusLabel})`)
    this.name = 'LeadConnectorError'
    this.category = category
    this.status = status
  }
}

export function categoryForStatus(status: number): LeadConnectorErrorCategory {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'upstream'
  return 'http'
}
