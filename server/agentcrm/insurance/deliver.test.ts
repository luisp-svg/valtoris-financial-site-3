import { describe, it, expect, vi } from 'vitest'
import { deliverQuote, type Delivery, type QuoteIdentity, type QuoteTransport } from './deliver'
import { QUOTE_LOCATION, QUOTE_PIPELINE, QUOTE_STAGE, quoteSyncEnabled } from './config'
function fixture(kind='auto') {
  const identity: QuoteIdentity = { firstName:'Synthetic',lastName:'Quote',email:'quote@example.invalid',phone:'+12025550189',kind,memberId:'member1' }
  const delivery: Delivery={lead_id:'lead1',claim_token:'token',contact_id:null,opportunity_id:null,contact_create_started:false,opportunity_create_started:false}
  let contact: Record<string,unknown>|null=null
  let opportunities: Record<string,unknown>[]=[]
  const write=vi.fn(async(method:string,path:string,body:Record<string,unknown>)=>{
    if(path==='/contacts/upsert') { contact={...body,id:'contact1'};return{contact} }
    if(method==='PUT') { contact={...contact,...body};return{contact} }
    const opportunity={...body,id:'opp1'};opportunities.push(opportunity);return{opportunity}
  })
  const get=vi.fn(async(path:string)=>{
    if(path==='/contacts/search/duplicate'||path==='/contacts/contact1')return{contact}
    return {opportunities,meta:{total:opportunities.length}}
  })
  const checkpoint=vi.fn(async(patch:Record<string,unknown>)=>{Object.assign(delivery,patch)})
  const saveLink=vi.fn(async()=>{})
  const input={delivery,identity,transport:{get,write} as QuoteTransport,linkedContactId:null as string|null,checkpoint,saveLink}
  return { input,write,get,setContact:(value:Record<string,unknown>)=>{contact=value},setOpportunities:(value:Record<string,unknown>[])=>{opportunities=value} }
}
describe('Quote delivery',()=>{
  it.each(['auto','home','commercial'])('creates %s contact and P&C opportunity then verifies exact identity',async kind=>{
    const f=fixture(kind);expect(await deliverQuote(f.input)).toEqual({contactId:'contact1',opportunityId:'opp1'})
    expect(f.write).toHaveBeenCalledWith('POST','/contacts/upsert',expect.objectContaining({firstName:'Synthetic',lastName:'Quote',email:'quote@example.invalid',phone:'+12025550189'}))
    expect(f.write).toHaveBeenCalledWith('POST','/opportunities/',expect.objectContaining({pipelineId:QUOTE_PIPELINE,pipelineStageId:QUOTE_STAGE,contactId:'contact1'}))
    expect(f.input.checkpoint).toHaveBeenLastCalledWith({status:'synced',last_code:'verified',opportunity_id:'opp1'})
    expect(JSON.stringify(f.write.mock.calls)).not.toMatch(/quoteAnswers|smsMarketingConsent|tags|workflow|dateOfBirth/)
  })
  it('replays and additional quote types reuse one contact and one open opportunity',async()=>{
    const f=fixture();await deliverQuote(f.input);await deliverQuote(f.input)
    f.input.identity.kind='home';await deliverQuote(f.input)
    expect(f.write.mock.calls.filter(call=>call[1]==='/contacts/upsert')).toHaveLength(1)
    expect(f.write.mock.calls.filter(call=>call[1]==='/opportunities/')).toHaveLength(1)
  })
  it('updates a verified linked contact and preserves a progressed opportunity',async()=>{
    const f=fixture();f.input.linkedContactId='contact1'
    f.setContact({...f.input.identity,id:'contact1',locationId:QUOTE_LOCATION,firstName:'OldName'})
    f.setOpportunities([{id:'opp1',contactId:'contact1',pipelineId:QUOTE_PIPELINE,pipelineStageId:'progressed',status:'open'}])
    await deliverQuote(f.input)
    expect(f.write).toHaveBeenCalledTimes(1)
    expect(f.write).toHaveBeenCalledWith('PUT','/contacts/contact1',expect.objectContaining({firstName:'Synthetic'}))
  })
  it('holds conflicting identities without any writes',async()=>{
    const f=fixture();f.setContact({...f.input.identity,id:'contact2',firstName:'SomeoneElse'})
    await expect(deliverQuote(f.input)).rejects.toThrow('identity_conflict');expect(f.write).not.toHaveBeenCalled()
  })
  it('never retries a create blindly after a lost contact response',async()=>{
    const f=fixture();f.input.delivery.contact_create_started=true
    await expect(deliverQuote(f.input)).rejects.toThrow('contact_outcome_unknown');expect(f.write).not.toHaveBeenCalled()
  })
  it('never retries a create blindly after a lost opportunity response',async()=>{
    const f=fixture();f.input.delivery.opportunity_create_started=true
    await expect(deliverQuote(f.input)).rejects.toThrow('opportunity_outcome_unknown')
    expect(f.write.mock.calls.filter(call=>call[1]==='/opportunities/')).toHaveLength(0)
  })
  it('holds multiple existing opportunities instead of creating another',async()=>{
    const f=fixture();f.setOpportunities([{id:'opp1'},{id:'opp2'}])
    await expect(deliverQuote(f.input)).rejects.toThrow('multiple_opportunities')
    expect(f.write.mock.calls.filter(call=>call[1]==='/opportunities/')).toHaveLength(0)
  })
  it('does not write after a failed lease checkpoint',async()=>{
    const f=fixture();f.input.checkpoint.mockRejectedValue(new Error('lease_lost'))
    await expect(deliverQuote(f.input)).rejects.toThrow('lease_lost');expect(f.write).not.toHaveBeenCalled()
  })
  it('stays disabled until sync and trigger-verification gates are explicitly set',()=>{
    const env={AGENTCRM_PRIVATE_INTEGRATION_TOKEN:'test',AGENTCRM_LOCATION_ID:QUOTE_LOCATION,SUPABASE_URL:'https://phanoknohbidqtgrpwvk.supabase.co'}
    expect(quoteSyncEnabled(env)).toBe(false)
    expect(quoteSyncEnabled({...env,AGENTCRM_INSURANCE_SYNC_ENABLED:'true'})).toBe(false)
    expect(quoteSyncEnabled({...env,AGENTCRM_INSURANCE_SYNC_ENABLED:'true',AGENTCRM_INSURANCE_TRIGGERS_VERIFIED:'true'})).toBe(true)
  })
})
