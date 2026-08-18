export const COMMISSION_PENDING_IMPORT_GENERIC_ERROR =
  'Unable to save this pending commission import. Please try again.'

export const COMMISSION_PENDING_IMPORT_LOAD_ERROR =
  'Unable to load pending commission imports. Please try again.'

export const COMMISSION_PENDING_IMPORT_STAGE_ERROR =
  'Unable to stage these pending commission rows. Nothing was posted to the ledger.'

export {
  formatCommissionImportUserError as formatCommissionPendingImportUserError,
} from '../import/commissionImportErrors'
