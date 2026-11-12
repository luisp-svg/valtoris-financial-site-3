import type { CarrierReview, Credential } from './types'
export type LicensingForm = {kind:'license_private'} | {kind:'edit'} | {kind:'credential';credentialKind:'license'|'eo';item?:Credential} | {kind:'carrier';item?:Partial<CarrierReview>}
/** Different new carriers and license/E&O forms must never reuse another form's draft state. */
export function licensingFormKey(form: LicensingForm): string {
 if (form.kind === 'credential') return `credential:${form.credentialKind}:${form.item?.id ?? 'new'}`
 if (form.kind === 'carrier') return `carrier:${form.item?.id ?? form.item?.carrier_id ?? 'new'}`
 return form.kind
}
