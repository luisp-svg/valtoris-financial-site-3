import { createSupabaseBrowserClient } from '../../lib/supabase/client'
export async function fetchReviewRows<T>(table:string):Promise<T[]> {
 const {data,error}=await createSupabaseBrowserClient().from(table).select('*').limit(1000)
 if(error)throw new Error('This workspace needs the local TAC operations migration. Existing client records have not been changed.')
 return (data||[]) as T[]
}
export async function saveReview(table:string,key:string,value:Record<string,unknown>,existing:boolean){
 const client=createSupabaseBrowserClient()
 const revision=Number(value.revision||1)
 const query=existing?client.from(table).update({...value,revision:revision+1}).eq(key,value[key]).eq('revision',revision):client.from(table).insert(value)
 const {data,error}=await query.select(key)
 if(error||!data?.length)throw new Error(error?.code==='23505'?'A record already exists. Reload and reconcile it.':'Save was not confirmed. Reload the record before retrying; another user may have changed it.')
}
