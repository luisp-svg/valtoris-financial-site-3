/**
 * LeadConnector / HighLevel API v2.
 * Private Integration tokens are sent only as an Authorization header.
 */
export const LEADCONNECTOR_API_BASE_URL = 'https://services.leadconnectorhq.com'

/** Required on every v2 request. */
export const LEADCONNECTOR_API_VERSION = '2021-07-28'

export const LEADCONNECTOR_TIMEOUT_MS = 10_000

export const AGENTCRM_TOKEN_ENV = 'AGENTCRM_PRIVATE_INTEGRATION_TOKEN'
export const AGENTCRM_LOCATION_ENV = 'AGENTCRM_LOCATION_ID'
