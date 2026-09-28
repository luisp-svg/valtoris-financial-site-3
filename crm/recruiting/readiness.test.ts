import { describe, expect, it } from 'vitest'
import { readinessGaps } from './readiness'
import type { CarrierReview, Credential } from './types'
import { recruitingError } from './api'
const license: Credential = { id:'l',recruit_id:'r',kind:'license',state:'TX',authority_scope:'life',provider_reference:'QA',status:'verified',effective_on:'2020-01-01',expires_on:'2030-01-01',no_expiration:false,evidence_reference:'reviewed',verified_at:'2026-01-01' }
const eo: Credential = { ...license,id:'e',kind:'eo',state:null,authority_scope:null }
const carrier: CarrierReview = { id:'c',recruit_id:'r',carrier_id:'provider',state:'TX',authority_scope:'life',contract_status:'verified',contract_effective_on:'2020-01-01',contract_expires_on:'2030-01-01',contract_no_expiration:false,contract_evidence:'reviewed',appointment_status:'verified',appointment_effective_on:'2020-01-01',appointment_expires_on:'2030-01-01',appointment_no_expiration:false,appointment_evidence:'reviewed',reviewed_at:'2026-01-01' }
describe('readiness explanations',()=>{
 it('needs all verified requirements and review',()=>{expect(readinessGaps(carrier,[license,eo],'2026-01-01')).toEqual([]);expect(readinessGaps({...carrier,reviewed_at:null},[],'2026-01-01')).toHaveLength(3)})
 it('does not substitute another state or scope',()=>{expect(readinessGaps({...carrier,state:'FL'},[license,eo],'2026-01-01')).toContain('Current verified license for this state and scope');expect(readinessGaps({...carrier,authority_scope:'health'},[license,eo],'2026-01-01')).toContain('Current verified license for this state and scope')})
 it('counts expiration day but excludes expired and future-effective evidence',()=>{expect(readinessGaps(carrier,[license,eo],'2030-01-01')).toEqual([]);expect(readinessGaps(carrier,[license,eo],'2030-01-02')).toHaveLength(4);expect(readinessGaps(carrier,[{...license,effective_on:'2027-01-01'},eo],'2026-01-01')).toHaveLength(1)})
 it('unknown expiration is not equivalent to confirmed no expiration',()=>{expect(readinessGaps(carrier,[{...license,expires_on:null},eo],'2026-01-01')).toHaveLength(1);expect(readinessGaps(carrier,[{...license,expires_on:null,no_expiration:true},eo],'2026-01-01')).toEqual([])})
 it('revocation prevents readiness',()=>{expect(readinessGaps({...carrier,appointment_status:'revoked'},[license,eo],'2026-01-01')).toContain('Current verified appointment')})
 it('explains duplicate and date failures without private database details',()=>{expect(recruitingError({code:'23505',message:'secret detail'})).not.toContain('secret');expect(recruitingError({code:'22007'})).toContain('YYYY-MM-DD')})
})
