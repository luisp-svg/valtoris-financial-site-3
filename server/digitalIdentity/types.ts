/**
 * Server-only Digital Identity public-read result types.
 */

import type { IdentitySurfacePublicDto } from '../../modules/digital-identity'

export type PublicCardLookupStatus =
  | 'found'
  | 'unavailable'
  | 'invalid_request'
  | 'server_error'

export type PublicCardLookupResult =
  | { status: 'found'; card: IdentitySurfacePublicDto }
  | { status: 'unavailable' }
  | { status: 'invalid_request'; reason: string }
  | { status: 'server_error' }

export type PublicCardLookupQuery =
  | { key: string; slug?: undefined }
  | { slug: string; key?: undefined }
