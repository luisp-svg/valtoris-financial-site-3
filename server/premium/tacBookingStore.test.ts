import type { SupabaseClient } from '@supabase/supabase-js'
import { expect,it,vi } from 'vitest'
import { SupabaseTacBookingStore } from './tacBookingStore'

it.each([
 ['P0001','identity_review_required','booking_identity_review_required'],
 ['42501','identity_review_required','tac_booking_database_unavailable'],
 ['P0001','private database details','tac_booking_database_unavailable'],
])('exposes only the allowlisted reservation error (%s, %s)',async(code,message,expected)=>{
 const rpc=vi.fn().mockResolvedValue({data:null,error:{code,message}})
 const store=new SupabaseTacBookingStore({rpc} as unknown as Pick<SupabaseClient,'rpc'>)
 await expect(store.reserve('submission','location','calendar','start','UTC')).rejects.toThrow(expected)
 await expect(store.load('submission')).rejects.toThrow('tac_booking_database_unavailable')
})
