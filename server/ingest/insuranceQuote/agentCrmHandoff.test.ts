import { expect,it } from 'vitest'
import { prepareQuoteAgentCrmHandoff } from './agentCrmHandoff'
it('projects only approved contact/context fields and holds unresolved matches',()=>{
 const input={submissionId:'test',kind:'auto' as const,firstName:'Test',lastName:'Person',email:'test@example.invalid',phone:'2025550148',preferredContact:'Email',consentVersion:'v1',consentedAt:'2026-09-24',contactPermission:true,matchResolved:true,assignedAdvisorId:null,birthDate:'private',vin:'private',annualRevenue:'private'}
 const result=prepareQuoteAgentCrmHandoff(input);expect(JSON.stringify(result)).not.toContain('private');expect(result.status).toBe('prepared_not_sent');expect(result).toHaveProperty('automaticMessagingEnabled',false);expect(prepareQuoteAgentCrmHandoff({...input,matchResolved:false}).status).toBe('held_for_review');expect(prepareQuoteAgentCrmHandoff({...input,contactPermission:false}).status).toBe('held_for_review')
})
