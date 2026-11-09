import type { Field } from './RecruitForm'
import { RECRUIT_STAGES, LICENSE_TYPES, APPOINTING_ORGANIZATIONS, stageLabel, type Option } from './types'
const choices = (...values: string[]): Option[] => values.map(value => ({ id: value, name: value === 'eo' ? 'E&O' : value[0].toUpperCase() + value.slice(1) }))
export const createFields = (advisors: Option[]): Field[] => [
  { key: 'full_name', label: 'Full name', required: true, maxLength: 200 },
  { key: 'email', label: 'Email', type: 'email', required: true, maxLength: 254 },
  { key: 'phone', label: 'Phone', maxLength: 80 },
  { key: 'license_types', label: 'License types', type: 'checkboxes', options: [...LICENSE_TYPES], hint: 'Select all that apply. State license evidence is recorded separately.' },
  { key: 'appointing_organization', label: 'Appointing under', options: [...APPOINTING_ORGANIZATIONS] },
  { key: 'contract_level', label: 'Contract level', maxLength: 120, hint: 'Enter the exact level from the contract; leave blank if not yet confirmed.' },
  { key: 'assigned_advisor_id', label: 'Follow-up owner', options: advisors, hint: 'Assignment tracks follow-up responsibility. Management remains with Luis and Jazmin.' },
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
  { key: 'provider_reference', label: kind === 'license' ? 'License number / reference' : 'E&O provider / policy reference', required: true },
  { key: 'status', label: 'Verification status', required: true, options: choices('reported', 'verified', 'revoked') },
  { key: 'effective_on', label: kind === 'license' ? 'Date issued' : 'Effective date', type: 'date' },
  { key: 'expires_on', label: 'Expiration date', type: 'date' },
  { key: 'no_expiration', label: 'No expiration confirmed', type: 'checkbox', hint: 'Select only when explicitly confirmed; leave expiration blank.' },
  { key: 'evidence_reference', label: 'Evidence reference', maxLength: 1000, hint: 'Required to verify. Record where the evidence was reviewed, without credentials or private documents.' },
]
export const carrierFields = (carriers: Option[]): Field[] => [
  { key: 'carrier_id', label: 'Carrier', required: true, options: carriers },
  { key: 'state', label: 'State or territory (two letters)', required: true, maxLength: 2 },
  { key: 'authority_scope', label: 'License scope', required: true, maxLength: 120, hint: 'Must match the verified license scope.' },
  { key: 'contract_progress', label: 'Contracting progress', required: true, options: [{id:'submitted',name:'Submitted'},{id:'pending',name:'Pending'},{id:'approved',name:'Approved'},{id:'code_issued',name:'Code Issued'}] },
  { key: 'writing_code', label: 'Carrier writing code', maxLength: 120, hint: 'Record the actual code issued by this carrier. Required for Code Issued.' },
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

export const privateLicenseFields: Field[] = [
 {key:'npn',label:'NPN #',required:true,maxLength:20},
 {key:'ssn_last_four',label:'SSN last four only',required:true,maxLength:4,hint:'Never enter a full Social Security number.'},
 {key:'dob',label:'Date of birth',type:'date',required:true},
 {key:'drivers_license_number',label:'Driver license #',required:true,maxLength:100},
 {key:'first_policy_reference',label:'First submitted policy reference',maxLength:200,hint:'Record the carrier policy or application reference after the first policy is submitted.'},
 {key:'first_policy_submitted_on',label:'First policy submission date',type:'date'},
]
