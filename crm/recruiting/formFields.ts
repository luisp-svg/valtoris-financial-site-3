import type { Field } from './RecruitForm'
import { RECRUIT_STAGES, stageLabel, type Option } from './types'
const choices = (...values: string[]): Option[] => values.map(value => ({ id: value, name: value === 'eo' ? 'E&O' : value[0].toUpperCase() + value.slice(1) }))
export const createFields = (advisors: Option[]): Field[] => [
  { key: 'full_name', label: 'Full name', required: true, maxLength: 200 },
  { key: 'email', label: 'Email', type: 'email', required: true, maxLength: 254 },
  { key: 'phone', label: 'Phone', maxLength: 80 },
  { key: 'assigned_advisor_id', label: 'Recruiting advisor', options: advisors, hint: 'Assignment tracks follow-up responsibility. Management remains with Luis and Jazmin.' },
]
export const editFields = (advisors: Option[]): Field[] => [...createFields(advisors),
  { key: 'advisor_profile_id', label: 'Link existing advisor account', options: advisors, hint: 'Select only the same person. Their account email must match. This does not create an account or change access.' },
  { key: 'stage', label: 'Workflow stage', required: true, options: RECRUIT_STAGES.map(s => ({ id: s, name: stageLabel(s) })) },
  { key: 'next_action', label: 'Next action', maxLength: 1000 },
  { key: 'next_action_due_on', label: 'Follow-up date', type: 'date' },
  { key: 'is_archived', label: 'Archived', type: 'checkbox', hint: 'Hide from the active recruiting list; history is retained.' },
]
export const credentialFields = (kind: 'license' | 'eo'): Field[] => [
  ...(kind === 'license' ? [{ key: 'state', label: 'State or territory (two letters)', required: true, maxLength: 2 }, { key: 'authority_scope', label: 'License scope', required: true, maxLength: 120, hint: 'Use the same scope on the carrier review, for example Life or Health.' }] as Field[] : []),
  { key: 'provider_reference', label: kind === 'license' ? 'License reference' : 'E&O provider / policy reference', required: true },
  { key: 'status', label: 'Verification status', required: true, options: choices('reported', 'verified', 'revoked') },
  { key: 'effective_on', label: 'Effective date', type: 'date' },
  { key: 'expires_on', label: 'Expiration date', type: 'date' },
  { key: 'no_expiration', label: 'No expiration confirmed', type: 'checkbox', hint: 'Select only when explicitly confirmed; leave expiration blank.' },
  { key: 'evidence_reference', label: 'Evidence reference', maxLength: 1000, hint: 'Required to verify. Record where the evidence was reviewed, without credentials or private documents.' },
]
export const carrierFields = (carriers: Option[]): Field[] => [
  { key: 'carrier_id', label: 'Carrier', required: true, options: carriers },
  { key: 'state', label: 'State or territory (two letters)', required: true, maxLength: 2 },
  { key: 'authority_scope', label: 'License scope', required: true, maxLength: 120, hint: 'Must match the verified license scope.' },
  ...(['contract', 'appointment'] as const).flatMap(prefix => {
    const label = prefix === 'contract' ? 'Contracting' : 'Appointment'
    return [
      { key: `${prefix}_status`, label: `${label} status`, required: true, options: choices('pending', 'verified', 'revoked') },
      { key: `${prefix}_effective_on`, label: `${label} effective date`, type: 'date' },
      { key: `${prefix}_expires_on`, label: `${label} expiration date`, type: 'date' },
      { key: `${prefix}_no_expiration`, label: `${label}: no expiration confirmed`, type: 'checkbox' },
      { key: `${prefix}_evidence`, label: `${label} evidence reference`, maxLength: 1000 },
    ] as Field[]
  }),
  { key: 'review_now', label: 'Record my readiness review now', type: 'checkbox', hint: 'Confirm that you reviewed this carrier, state, scope, and the supporting credentials. Readiness still requires current verified records.' },
]
