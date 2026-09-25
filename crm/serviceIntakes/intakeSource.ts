import { loadSharedProfile } from './sharedProfile'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchManualContactDetail } from '../contacts/contactsApi'
import { extractSubmittedIdentity } from '../intake/intakeFormatters'
import { fetchPublicFamilyDiagnosticDetail } from '../households/assessments/householdAssessmentsApi'
import { emptyStudentLoanIntake, type IntakeAnswers } from './studentLoanSchema'

export type IntakeOrigin = { kind: 'contact' | 'report_card' | 'member'; id: string; householdId: string }
export type IntakeSource = {
  origin: IntakeOrigin
  sourceLabel: string
  sourceDate: string | null
  clientName: string
  answers: IntakeAnswers
  priorResponses: { id: string; label: string; value: string }[]
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseIntakeOrigin(householdId: string, search: URLSearchParams): IntakeOrigin | null {
  const contact = search.get('contact'), report = search.get('report'), member = search.get('member')
  if (!UUID.test(householdId) || [contact,report,member].filter(Boolean).length !== 1 || !UUID.test(contact || report || member || '')) return null
  return { householdId, kind: member ? 'member' : contact ? 'contact' : 'report_card', id: member || contact || report! }
}
export function studentLoanIntakePath(origin: IntakeOrigin): string {
  return clientIntakePath(origin, 'student-loan-intake')
}
export function lifeInsuranceIntakePath(origin: IntakeOrigin): string {
  return clientIntakePath(origin, 'life-insurance-intake')
}
function clientIntakePath(origin: IntakeOrigin, route: string): string {
  return `/crm/households/${encodeURIComponent(origin.householdId)}/${route}?${origin.kind === 'member' ? 'member' : origin.kind === 'contact' ? 'contact' : 'report'}=${encodeURIComponent(origin.id)}`
}
/** All reads use the signed-in CRM client and existing RLS. A URL alone cannot create a client. */
export async function loadStudentLoanIntakeSource(client: SupabaseClient, origin: IntakeOrigin): Promise<IntakeSource> {
  return loadClientIntakeSource(client, origin, emptyStudentLoanIntake)
}
export async function loadClientIntakeSource(client: SupabaseClient, origin: IntakeOrigin, empty: () => IntakeAnswers): Promise<IntakeSource> {
  const unavailable = () => new Error('Open this intake from an available contact or completed report card for this household.')
  const { data: household, error } = await client.from('households')
    .select('id, state').eq('id', origin.householdId).is('deleted_at', null).is('merged_into_household_id', null).maybeSingle()
  if (error || !household) throw unavailable()
  const answers = empty()
  const core = answers.sections.client[0]
  core.state = typeof household.state === 'string' ? household.state : ''
  if (origin.kind === 'member') {
    const {data:member,error:memberError}=await client.from('household_members').select('first_name,last_name,email,phone').eq('id',origin.id).eq('household_id',origin.householdId).is('deleted_at',null).maybeSingle()
    if(memberError||!member)throw unavailable()
    const shared=await loadSharedProfile(client,origin.householdId,origin.id)
    Object.assign(core,{firstName:member.first_name,lastName:member.last_name,email:member.email??'',phone:member.phone??''})
    if(shared)for(const key of ['firstName','lastName','email','phone','state'] as const)core[key]=shared.facts[key]
    return {origin,answers,clientName:[core.firstName,core.lastName].join(' '),sourceLabel:'Household member',sourceDate:shared?.confirmed_at??null,priorResponses:[]}
  }
  if (origin.kind === 'contact') {
    const contact = await fetchManualContactDetail(client, origin.id)
    if (!contact || contact.detail.householdId !== origin.householdId) throw unavailable()
    const form = contact.formSeed
    Object.assign(core, { firstName: form.first_name, lastName: form.last_name, email: form.email, phone: form.phone })
    return { origin, answers, clientName: contact.detail.fullName, sourceLabel: 'Existing contact', sourceDate: contact.detail.dateEntered, priorResponses: [] }
  }
  const report = await fetchPublicFamilyDiagnosticDetail(client, origin.householdId, origin.id)
  if (!report) throw unavailable()
  const snapshot = report.submittedSnapshot
  Object.assign(core, { firstName: snapshot.firstName ?? '', lastName: snapshot.lastName ?? '', email: snapshot.email ?? '', phone: snapshot.phone ?? '' })
  if (report.lead?.leadId) {
    const { data: lead, error: leadError } = await client.from('leads').select('raw_payload, normalized_email, normalized_phone')
      .eq('id', report.lead.leadId).eq('household_id', origin.householdId).is('deleted_at', null).maybeSingle()
    if (leadError) throw unavailable()
    if (lead) {
      const identity = extractSubmittedIdentity(lead.raw_payload)
      core.firstName = identity.firstName ?? core.firstName
      core.lastName = identity.lastName ?? core.lastName
      core.email = identity.email ?? lead.normalized_email ?? core.email
      core.phone = identity.phone ?? lead.normalized_phone ?? core.phone
    }
  }
  // Prior diagnostic bands remain dated evidence, never promoted to exact amounts or verified facts.
  return { origin, answers, clientName: [core.firstName, core.lastName].filter(Boolean).join(' ') || 'Existing client', sourceLabel: report.productLabel, sourceDate: report.completedAt, priorResponses: report.submittedAnswers }
}
