import type { SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES, crmProductLabelForAssessment } from '../../modules/reportCard/publicIngestCatalog'
import { lifeInsuranceIntakePath, studentLoanIntakePath, type IntakeOrigin } from './intakeSource'
export const CLIENT_INTAKE_SERVICES = [
  { id: 'life_insurance_intake', label: 'Life Insurance', path: lifeInsuranceIntakePath },
  { id: 'student_loan_intake', label: 'Student Loan', path: studentLoanIntakePath },
] as const
export type IntakeHubSource = { origin: IntakeOrigin; label: string }
export async function loadIntakeHubSources(client: SupabaseClient, householdId: string, kind: IntakeOrigin['kind'], page: number): Promise<IntakeHubSource[]> {
  if (kind === 'contact') {
    const { data, error } = await client.from('leads').select('id,submitted_at,normalized_email,normalized_phone').eq('household_id', householdId).eq('lead_type','Manual Contact').is('deleted_at',null).order('submitted_at',{ascending:false}).order('id').range(page*25,page*25+24)
    if (error) throw new Error('Unable to load contacts.')
    return (data ?? []).map(row => ({ origin: {householdId,kind,id:row.id}, label: `Contact · ${row.normalized_email || row.normalized_phone || 'Details on file'} · ${new Date(row.submitted_at).toLocaleDateString()}` }))
  }
  const { data, error } = await client.from('assessments').select('id,assessment_type,completed_at').eq('household_id', householdId).eq('capture_channel','public_self_report').eq('status','completed').in('assessment_type',[...PUBLIC_REPORT_CARD_ASSESSMENT_TYPES]).is('deleted_at',null).order('completed_at',{ascending:false}).order('id').range(page*25,page*25+24)
  if (error) throw new Error('Unable to load completed report cards.')
  return (data ?? []).map(row => ({ origin:{householdId,kind,id:row.id}, label:`${crmProductLabelForAssessment(row.assessment_type)} · ${new Date(row.completed_at).toLocaleDateString()}` }))
}
export type IntakeHubStatus = { type: typeof CLIENT_INTAKE_SERVICES[number]['id']; status: 'draft' | 'completed'; updatedAt: string }
export async function loadIntakeHubStatus(client: SupabaseClient, origin: IntakeOrigin): Promise<IntakeHubStatus[]> {
  // Query the latest draft and completion separately per service, without downloading answers.
  return (await Promise.all(CLIENT_INTAKE_SERVICES.map(async service => {
    const queries = await Promise.all(['draft','completed'].map(status => client.from('assessments').select('assessment_type,status,updated_at').eq('household_id',origin.householdId).eq('assessment_type',service.id).eq('capture_channel','advisor_onboarding').eq('status',status).contains('derived_metrics',{intake_origin:{kind:origin.kind,id:origin.id}}).is('deleted_at',null).order('updated_at',{ascending:false}).limit(1)))
    if (queries.some(q => q.error)) throw new Error('Unable to load intake progress.')
    const row = queries[0].data?.[0] ?? queries[1].data?.[0]
    return row ? { type:service.id,status:row.status as 'draft'|'completed',updatedAt:row.updated_at } : null
  }))).filter((row): row is IntakeHubStatus => row !== null)
}
