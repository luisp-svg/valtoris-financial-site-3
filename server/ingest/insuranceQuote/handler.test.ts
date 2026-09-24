import { beforeEach, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../../../api/insurance-quote'
import { syncQuoteDelivery } from '../../agentcrm/insurance/worker'
import { ingestQuote } from './ingest'
import { _resetRateLimitStateForTests } from '../familyReportCard/abuse'
vi.mock('../../agentcrm/insurance/worker',()=>({syncQuoteDelivery:vi.fn().mockResolvedValue('idle')}))
vi.mock('./ingest',()=>({ingestQuote:vi.fn().mockResolvedValue({status:200,body:{ok:true}})}))
beforeEach(()=>{vi.clearAllMocks();_resetRateLimitStateForTests()})
function response(){const res={setHeader:vi.fn(),status:vi.fn(),json:vi.fn()};res.status.mockReturnValue(res);return res}
function request(change:Record<string,unknown>={}) { return {method:'POST',headers:{host:'valtorisfinancial.com',origin:'https://valtorisfinancial.com','content-type':'application/json'},body:{},...change} as VercelRequest }
it('rejects cross-origin requests before persistence',async()=>{const res=response();await handler(request({headers:{host:'valtorisfinancial.com',origin:'https://untrusted.example','content-type':'application/json'}}),res as unknown as VercelResponse);expect(res.status).toHaveBeenCalledWith(403);expect(ingestQuote).not.toHaveBeenCalled()})
it('rejects unsupported methods and oversized payloads',async()=>{const res=response();await handler(request({method:'DELETE'}),res as unknown as VercelResponse);expect(res.status).toHaveBeenCalledWith(405);await handler(request({body:{x:'x'.repeat(65001)}}),res as unknown as VercelResponse);expect(res.status).toHaveBeenCalledWith(413);expect(ingestQuote).not.toHaveBeenCalled()})
it('uses no-store and acknowledges only the persistence result',async()=>{const res=response();await handler(request(),res as unknown as VercelResponse);expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','no-store');expect(res.json).toHaveBeenCalledWith({ok:true})})
it('rate limits repeated requests without additional saves',async()=>{const res=response();for(let i=0;i<11;i++)await handler(request(),res as unknown as VercelResponse);expect(ingestQuote).toHaveBeenCalledTimes(10);expect(res.status).toHaveBeenLastCalledWith(429)})

it('protects retry processing with the server secret',async()=>{vi.stubEnv('CRON_SECRET','synthetic-secret');const res=response();await handler(request({method:'GET'}),res as unknown as VercelResponse);expect(res.status).toHaveBeenLastCalledWith(401);expect(syncQuoteDelivery).not.toHaveBeenCalled();await handler(request({method:'GET',headers:{authorization:'Bearer synthetic-secret'}}),res as unknown as VercelResponse);expect(syncQuoteDelivery).toHaveBeenCalledTimes(1);expect(res.status).toHaveBeenLastCalledWith(200);vi.unstubAllEnvs()})
