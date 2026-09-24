import { describe, expect, it } from 'vitest'
import { activeSections, pruneAnswers, QUOTE_SECTIONS } from './catalog'
import { fieldError, validateQuote } from './validation'
import { quoteFixture } from './fixtures'
describe('insurance quote trust boundary', () => {
  it.each(['auto','home','commercial'] as const)('accepts a complete %s request', kind => expect(validateQuote(quoteFixture(kind)).ok).toBe(true))
  it('requires consent without assuming it from contact information', () => { const body=quoteFixture(); body.consent.contact=false; expect(validateQuote(body).ok).toBe(false) })
  it.each(['householdId','assignedAdvisorId','lead_type','agentcrmToken'])('rejects browser-supplied %s', key => expect(validateQuote({ ...quoteFixture(), [key]:'untrusted' }).ok).toBe(false))
  it('rejects hidden business data when the coverage is not selected', () => { const body=quoteFixture('commercial'); expect(validateQuote({ ...body, answers:{ ...body.answers, autoLiability:'1000000' } }).ok).toBe(false) })
  it('drops de-selected coverage answers and pool details', () => {
    expect(pruneAnswers('commercial',{ lines:['Workers’ Compensation'], autoLiability:'1000000', operatingStates:'TX' })).toEqual({ lines:['Workers’ Compensation'], operatingStates:'TX' })
    expect(pruneAnswers('home',{ risks:['None'], poolType:'Below ground' })).toEqual({ risks:['None'] })
  })
  it('opens both GL and property for BOP, WC independently', () => {
    expect(activeSections('commercial',{ lines:['BOP'] }).map(x=>x.id)).toEqual(['business','risk','gl','property'])
    expect(activeSections('commercial',{ lines:['Workers’ Compensation'] }).map(x=>x.id)).toEqual(['business','risk','wc'])
  })
  it('rejects contradictory None and specific selections', () => expect(fieldError(QUOTE_SECTIONS.home[1].fields.find(f=>f.id==='risks')!,['None','Pool'])).not.toBeNull())
  it('rejects impossible and future birth dates', () => {
    expect(fieldError({id:'birthDate',label:'DOB',type:'date'},'2024-02-30')).not.toBeNull()
    expect(fieldError({id:'birthDate',label:'DOB',type:'date'},'2099-01-01')).not.toBeNull()
  })
  it('rejects row injection and excessive repeaters', () => {
    const body=quoteFixture(); expect(validateQuote({...body,answers:{...body.answers,drivers:[{name:'Test',ssn:'123'}]}}).ok).toBe(false)
    expect(validateQuote({...body,answers:{...body.answers,drivers:Array.from({length:21},()=>({name:'Test'}))}}).ok).toBe(false)
  })
  it('rejects malformed email/filter injection, invalid phone and whitespace names', () => {
    for(const change of [{email:'a@example.com,deleted_at.is.null'},{phone:'123'},{firstName:'  '}]) expect(validateQuote({...quoteFixture(),contact:{...quoteFixture().contact,...change}}).ok).toBe(false)
  })
  it('rejects bots and impossible start times', () => {
    for(const change of [{website:'bot'},{formStartedAt:Date.now()+1000},{formStartedAt:NaN}]) expect(validateQuote({...quoteFixture(),...change}).ok).toBe(false)
  })
})
