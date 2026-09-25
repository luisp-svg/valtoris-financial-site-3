import { ADDITIONAL_SERVICE_CONTRACTS } from './additionalServiceSchema'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES, crmProductLabelForAssessment } from '../../modules/reportCard/publicIngestCatalog'
import { lifeInsuranceIntakePath, studentLoanIntakePath, type IntakeOrigin } from './intakeSource'
export const CLIENT_INTAKE_SERVICES = [
  { id: 'life_insurance_intake', assessmentType:'life_insurance_intake', label: 'Life Insurance', path: lifeInsuranceIntakePath },
  { id: 'student_loan_intake', assessmentType:'student_loan_intake', label: 'Student Loan', path: studentLoanIntakePath },
  ...Object.entries(ADDITIONAL_SERVICE_CONTRACTS).map(([id,c])=>({id,assessmentType:'service_intake',label:c.label,path:(origin:IntakeOrigin)=>`/crm/households/${origin.householdId}/service-intake/${id}?${origin.kind==='report_card'?'report':origin.kind}=${origin.id}`})),
] as const
export type IntakeHubSource = { origin: IntakeOrigin; label: string }
export async function loadIntakeHubSources(client: SupabaseClient, householdId: string, kind: IntakeOrigin['kind'], page: number): Promise<IntakeHubSource[]> {
  if(kind==='member'){
    const {data,error}=await client.from('household_members').select('id,first_name,last_name').eq('household_id',householdId).is('deleted_at',null).order('first_name').order('id').range(page*25,page*25+24)
    if(error)throw new Error('Unable to load household members.')
    return (data??[]).map(row=>({origin:{householdId,kind,id:row.id},label:[row.first_name,row.last_name].join(' ')}))
  }
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
  const {data,error}=await client.rpc('client_intake_progress',{p_household_id:origin.householdId,p_origin_kind:origin.kind,p_origin_id:origin.id})
  if(error||!Array.isArray(data))throw new Error('Unable to load intake progress.')
  return data.map(row=>{
    if(!CLIENT_INTAKE_SERVICES.some(s=>s.id===row.type)||!['draft','completed'].includes(row.status)||typeof row.updated_at!=='string')throw new Error('Unable to load intake progress.')
    return {type:row.type,status:row.status,updatedAt:row.updated_at}
  })
}

export type SavedIntakeSummary = {
  id: string
  label: string
  status: 'draft' | 'completed'
  updatedAt: string
  origin: IntakeOrigin
  href: string
}
/** Metadata only; existing assessment RLS determines which household intakes are visible. */
export async function loadHouseholdSavedIntakes(client: SupabaseClient, householdId: string, page: number): Promise<{ items: SavedIntakeSummary[]; hasMore: boolean }> {
  const { data, error } = await client.from('assessments')
    .select('id,assessment_type,status,updated_at,derived_metrics')
    .eq('household_id', householdId).eq('capture_channel', 'advisor_onboarding')
    .in('assessment_type', ['life_insurance_intake', 'student_loan_intake', 'service_intake'])
    .in('status', ['draft', 'completed']).is('deleted_at', null)
    .order('updated_at', { ascending: false }).order('id')
    .range(page * 10, page * 10 + 10)
  if (error || !Array.isArray(data)) throw new Error('Unable to load saved intakes.')
  const items = data.slice(0, 10).map(row => {
    const metrics = row.derived_metrics
    const rawOrigin = metrics?.intake_origin
    const service = CLIENT_INTAKE_SERVICES.find(s => s.id === (row.assessment_type === 'service_intake' ? metrics?.service_id : row.assessment_type))
    if (!service || service.assessmentType !== row.assessment_type || !rawOrigin || !['member', 'contact', 'report_card'].includes(rawOrigin.kind)
      || typeof rawOrigin.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawOrigin.id)
      || !['draft', 'completed'].includes(row.status) || typeof row.id !== 'string'
      || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) {
      throw new Error('Unable to confirm saved intake details.')
    }
    const origin: IntakeOrigin = { householdId, kind: rawOrigin.kind, id: rawOrigin.id }
    return { id: row.id, label: service.label, status: row.status as 'draft' | 'completed', updatedAt: row.updated_at, origin, href: service.path(origin) }
  })
  return { items, hasMore: data.length > 10 }
}
