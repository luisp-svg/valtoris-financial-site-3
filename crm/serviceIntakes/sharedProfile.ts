import type { SupabaseClient } from '@supabase/supabase-js'
export const SHARED_FIELDS = [
 ['firstName','Legal first name','text'],['lastName','Legal last name','text'],['email','Email','email'],['phone','Phone','text'],['birthDate','Date of birth','date'],['address','Street address','text'],['city','City','text'],['state','State','text'],['postalCode','ZIP / postal code','text'],['employmentStatus','Employment status','text'],['employer','Employer','text'],['occupation','Occupation','text'],['annualIncome','Annual gross income ($)','text'],['incomeAsOf','Income confirmed as of','date'],['preferredLanguage','Preferred language','text'],
] as const
export type SharedFacts = Record<typeof SHARED_FIELDS[number][0],string>
export type SharedProfile = { member_id:string; household_id:string; facts:SharedFacts; updated_at:string; confirmed_at:string }
export const emptySharedFacts = ():SharedFacts => Object.fromEntries(SHARED_FIELDS.map(([k])=>[k,''])) as SharedFacts
export function validateSharedFacts(raw:unknown):string[] {
 if(!raw || typeof raw!=='object' || Array.isArray(raw)) return ['Invalid shared client information.']
 const r=raw as Record<string,unknown>
 if(Object.keys(r).length!==SHARED_FIELDS.length || SHARED_FIELDS.some(([k])=>typeof r[k]!=='string' || (r[k] as string).length>300)) return ['Invalid shared client information.']
 const a=r as SharedFacts, errors:string[]=[]
 if(!a.firstName.trim()||!a.lastName.trim()) errors.push('Enter the client’s legal first and last name.')
 if(a.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) errors.push('Enter a valid email.')
 for(const k of ['birthDate','incomeAsOf'] as const) if(a[k] && (!/^\d{4}-\d{2}-\d{2}$/.test(a[k]) || Number.isNaN(Date.parse(a[k])) || new Date(a[k]).toISOString().slice(0,10)!==a[k] || a[k]<'1900-01-01' || a[k]>new Date().toISOString().slice(0,10))) errors.push('Use a valid date that is not in the future.')
 if(a.annualIncome&&(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(a.annualIncome)||Number(a.annualIncome)>100000000||!a.incomeAsOf)) errors.push('Enter a valid income amount and its confirmation date.')
 return errors
}
export async function loadSharedProfile(client:SupabaseClient,householdId:string,memberId:string):Promise<SharedProfile|null>{
 const {data,error}=await client.from('client_intake_profiles').select('member_id,household_id,facts,updated_at,confirmed_at').eq('household_id',householdId).eq('member_id',memberId).maybeSingle()
 if(error) throw new Error('Unable to load shared client information.')
 return data
}
export async function saveSharedProfile(client:SupabaseClient,householdId:string,memberId:string,facts:SharedFacts,previous:SharedProfile|null):Promise<SharedProfile>{
 const errors=validateSharedFacts(facts);if(errors.length)throw new Error(errors[0])
 const {data,error}=await client.rpc('save_client_intake_profile',{p_household_id:householdId,p_member_id:memberId,p_expected_updated_at:previous?.updated_at??null,p_facts:facts})
 if(error)throw new Error(error.message.includes('INTAKE:conflict')?'Another advisor updated this information. Reload before saving.':'Unable to save shared client information.')
 if(data?.member_id!==memberId||data.household_id!==householdId||typeof data.updated_at!=='string'||validateSharedFacts(data.facts).length)throw new Error('The update could not be confirmed. Reload before trying again.')
 return data
}
