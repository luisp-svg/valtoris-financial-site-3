import type {Recruit,RecruitStage} from './types'
/** The existing edit RPC requires the full editable record and checks its revision. */
export function licensingStagePayload(record:Recruit,stage:RecruitStage){
 return {full_name:record.full_name,email:record.email,phone:record.phone,assigned_advisor_id:record.assigned_advisor_id,advisor_profile_id:record.advisor_profile_id,stage,next_action:record.next_action,next_action_due_on:record.next_action_due_on,is_archived:record.is_archived,license_types:record.license_types,appointing_organization:record.appointing_organization,contract_level:record.contract_level}
}
