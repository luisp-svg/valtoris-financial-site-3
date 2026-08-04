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
} from './types'

export {
  issueRelationshipPhotoUploadGrant,
  hashPhotoUploadToken,
  buildRelationshipPhotoStoragePath,
} from './photoGrant'
export type {
  RelationshipPhotoGrantResult,
} from './photoGrant'

export {
  normalizeRelationshipPhoto,
  RELATIONSHIP_PHOTO_MAX_BYTES,
} from './normalizeRelationshipPhoto'

export {
  uploadRelationshipPhoto,
} from './uploadRelationshipPhoto'
export type {
  UploadRelationshipPhotoResult,
} from './uploadRelationshipPhoto'

export {
  validateDigitalIdentityConnectRequest,
} from './validation'
export type { ValidationErr, ValidationOk, ValidationOptions, ValidationResult } from './validation'

export {
  resolveCardForIngest,
} from './resolveCardForIngest'
export type {
  ResolveCardForIngestError,
  ResolveCardForIngestInput,
  ResolveCardForIngestResult,
  ResolveCardForIngestSuccess,
} from './resolveCardForIngest'

export {
  persistDigitalIdentityConnect,
} from './persist'
export type {
  DigitalIdentityConnectRpcPayload,
  PersistDigitalIdentityConnectError,
  PersistDigitalIdentityConnectResult,
  PersistDigitalIdentityConnectSuccess,
} from './persist'

export {
  orchestrateDigitalIdentityFollowUpTask,
  workflowForDigitalIdentityMatchStatus,
} from './taskAutomation'
export type {
  DigitalIdentityTaskWorkflow,
  TaskAutomationOutcome,
} from './taskAutomation'

export {
  ingestDigitalIdentityConnect,
} from './ingestDigitalIdentityConnect'
export type { IngestDigitalIdentityConnectDeps } from './ingestDigitalIdentityConnect'
