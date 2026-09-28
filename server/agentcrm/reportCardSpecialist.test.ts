import { describe, expect, it, vi } from 'vitest'
import { assignReportCardSpecialist } from './reportCardSpecialist'
import { STUDENT_LOAN_CONTACT_OWNER_ID as liz } from './reportCardFollowUpConfig'
function fixture() {
  let owner = 'previousOwner'
  const input = {assessmentType:'student_loan',contactId:'contact123',checkpoint:vi.fn(async()=>{}),readVerifiedOwner:vi.fn(async()=>owner),assignOwner:vi.fn(async(_contact:string,next:string)=>{owner=next})}
  return {input}
}
describe('direct student-loan specialist routing',()=>{
  it('assigns Lizbeth even when another owner exists, then verifies ownership',async()=>{
    const {input}=fixture();await assignReportCardSpecialist(input)
    expect(input.assignOwner).toHaveBeenCalledWith('contact123',liz)
    expect(input.readVerifiedOwner).toHaveBeenCalledTimes(2)
    await assignReportCardSpecialist(input);expect(input.assignOwner).toHaveBeenCalledTimes(1)
  })
  it.each(['family','business','retirement','protection','credit','home_buyer'])('does not change ownership for %s',async assessmentType=>{
    const {input}=fixture();await assignReportCardSpecialist({...input,assessmentType})
    expect(input.assignOwner).not.toHaveBeenCalled();expect(input.readVerifiedOwner).not.toHaveBeenCalled()
  })
  it('stops if identity verification fails',async()=>{
    const {input}=fixture();input.readVerifiedOwner.mockRejectedValue(new Error('contact_verification_failed'))
    await expect(assignReportCardSpecialist(input)).rejects.toThrow('contact_verification_failed');expect(input.assignOwner).not.toHaveBeenCalled()
  })
  it('does not write when consent or lease checkpoint fails',async()=>{
    const {input}=fixture();input.checkpoint.mockResolvedValueOnce().mockRejectedValueOnce(new Error('lease_lost'))
    await expect(assignReportCardSpecialist(input)).rejects.toThrow('lease_lost');expect(input.assignOwner).not.toHaveBeenCalled()
  })
  it('holds a mismatched read-back instead of proceeding',async()=>{
    const {input}=fixture();input.assignOwner.mockResolvedValue(undefined)
    await expect(assignReportCardSpecialist(input)).rejects.toThrow('contact_owner_verification_failed')
  })
  it('reconciles a lost response without another owner write',async()=>{
    const {input}=fixture();const assign=input.assignOwner.getMockImplementation()!
    input.assignOwner.mockImplementationOnce(async(id,owner)=>{await assign(id,owner);throw new Error('network')})
    await expect(assignReportCardSpecialist(input)).rejects.toThrow('network')
    await assignReportCardSpecialist(input);expect(input.assignOwner).toHaveBeenCalledTimes(1)
  })
})
