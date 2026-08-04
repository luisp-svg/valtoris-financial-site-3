/**
 * SERVER ONLY — Digital Identity public-read + ingest card resolution.
 * Never import from browser/Vite client code.
 */

export {
  lookupPublishedCard,
  lookupPublishedCardByPublicKey,
  lookupPublishedCardBySlug,
  publicCardLookupSideEffects,
} from './lookupPublishedCard'
export type { LookupPublishedCardDeps } from './lookupPublishedCard'

export {
  generatePublishedCardQr,
  publishedCardQrSideEffects,
} from './generatePublishedCardQr'
export type {
  GeneratePublishedCardQrDeps,
  GeneratePublishedCardQrQuery,
  GeneratePublishedCardQrResult,
  GeneratePublishedCardQrSuccess,
} from './generatePublishedCardQr'

/** Ingest-time card resolution (trusted advisorProfileId). Admin / server-only. */
export {
  resolveCardForIngest,
} from '../ingest/digitalIdentity/resolveCardForIngest'
export type {
  ResolveCardForIngestError,
  ResolveCardForIngestInput,
  ResolveCardForIngestResult,
  ResolveCardForIngestSuccess,
} from '../ingest/digitalIdentity/resolveCardForIngest'

export type {
  PublicCardLookupQuery,
  PublicCardLookupResult,
  PublicCardLookupStatus,
} from './types'
