/**
 * SERVER ONLY — Digital Identity / Let's Connect CRM ingest.
 * Do not import from browser packages.
 */

export type {
  DigitalIdentityConnectError,
  DigitalIdentityConnectRequest,
  DigitalIdentityConnectResult,
  DigitalIdentityConnectSuccess,
  MatchConfidence,
  MatchStatus,
  RelationshipPhotoAvailability,
} from './types.js'

export {
  issueRelationshipPhotoUploadGrant,
  hashPhotoUploadToken,
  buildRelationshipPhotoStoragePath,
} from './photoGrant.js'
export type {
  RelationshipPhotoGrantResult,
} from './photoGrant.js'

export {
  normalizeRelationshipPhoto,
  RELATIONSHIP_PHOTO_MAX_BYTES,
} from './normalizeRelationshipPhoto.js'

export {
  uploadRelationshipPhoto,
} from './uploadRelationshipPhoto.js'
export type {
  UploadRelationshipPhotoResult,
} from './uploadRelationshipPhoto.js'

export {
  validateDigitalIdentityConnectRequest,
} from './validation.js'
export type { ValidationErr, ValidationOk, ValidationOptions, ValidationResult } from './validation.js'

export {
  resolveCardForIngest,
} from './resolveCardForIngest.js'
export type {
  ResolveCardForIngestError,
  ResolveCardForIngestInput,
  ResolveCardForIngestResult,
  ResolveCardForIngestSuccess,
} from './resolveCardForIngest.js'

export {
  persistDigitalIdentityConnect,
} from './persist.js'
export type {
  DigitalIdentityConnectRpcPayload,
  PersistDigitalIdentityConnectError,
  PersistDigitalIdentityConnectResult,
  PersistDigitalIdentityConnectSuccess,
} from './persist.js'

export {
  orchestrateDigitalIdentityFollowUpTask,
  workflowForDigitalIdentityMatchStatus,
} from './taskAutomation.js'
export type {
  DigitalIdentityTaskWorkflow,
  TaskAutomationOutcome,
} from './taskAutomation.js'

export {
  ingestDigitalIdentityConnect,
} from './ingestDigitalIdentityConnect.js'
export type { IngestDigitalIdentityConnectDeps } from './ingestDigitalIdentityConnect.js'
