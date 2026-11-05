import {expect,it} from 'vitest'
import {licensingStagePayload} from './licensingStageMove'
import type {Recruit} from './types'
it('changes only the workflow stage while retaining profile details and follow-up',()=>{
 const record:Recruit={id:'agent',full_name:'Synthetic Agent',email:'agent@example.invalid',phone:'+12025550100',license_types:['life_health'],appointing_organization:'experior',contract_level:'Recorded level',advisor_profile_id:'profile',assigned_advisor_id:'owner',stage:'licensing',next_action:'Verify evidence',next_action_due_on:'2027-01-01',is_archived:false,revision:12,updated_at:'2026-11-05T12:00:00Z'}
 const payload=licensingStagePayload(record,'eo')
 expect(payload).toMatchObject({stage:'eo',license_types:record.license_types,appointing_organization:record.appointing_organization,contract_level:record.contract_level,next_action:record.next_action,next_action_due_on:record.next_action_due_on,advisor_profile_id:record.advisor_profile_id})
 expect(record.stage).toBe('licensing');expect(payload).not.toHaveProperty('revision');expect(payload).not.toHaveProperty('updated_at')
})
