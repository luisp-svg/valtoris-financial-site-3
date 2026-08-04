/**
 * SERVER ONLY — Digital Identity public-read + ingest card resolution.
 * Never import from browser/Vite client code.
 */

export {
  lookupPublishedCard,
  lookupPublishedCardByPublicKey,
  lookupPublishedCardBySlug,
  publicCardLookupSideEffects,
} from './lookupPublishedCard.js'
export type { LookupPublishedCardDeps } from './lookupPublishedCard.js'

export {
  generatePublishedCardQr,
  publishedCardQrSideEffects,
} from './generatePublishedCardQr.js'
export type {
  GeneratePublishedCardQrDeps,
  GeneratePublishedCardQrQuery,
  GeneratePublishedCardQrResult,
  GeneratePublishedCardQrSuccess,
} from './generatePublishedCardQr.js'

/** Ingest-time card resolution (trusted advisorProfileId). Admin / server-only. */
export {
  resolveCardForIngest,
} from '../ingest/digitalIdentity/resolveCardForIngest.js'
export type {
  ResolveCardForIngestError,
  ResolveCardForIngestInput,
  ResolveCardForIngestResult,
  ResolveCardForIngestSuccess,
} from '../ingest/digitalIdentity/resolveCardForIngest.js'

export type {
  PublicCardLookupQuery,
  PublicCardLookupResult,
  PublicCardLookupStatus,
} from './types.js'
