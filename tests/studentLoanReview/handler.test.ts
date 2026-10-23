import {beforeEach,describe,it,expect,vi} from 'vitest'
import type {VercelRequest,VercelResponse} from '@vercel/node'
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),from:vi.fn(),admin:vi.fn()}))
vi.mock('../../lib/supabase/server.js',()=>({createSupabaseServerClient:()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc,from:mocks.from})}))
vi.mock('../../lib/supabase/admin.js',()=>({createSupabaseAdminClient:mocks.admin}))
import {studentLoanHandler,trustedLoanOrigin} from '../../server/studentLoanReview/handler'
function response(){const r={statusCode:200,body:null as unknown,setHeader:vi.fn(),status(code:number){this.statusCode=code;return this},json(body:unknown){this.body=body;return this},send(body:unknown){this.body=body;return this}};return r}
const request=(body:unknown,headers:Record<string,string>={})=>({method:'POST',headers:{origin:'https://www.valtorisfinancial.com','content-type':'application/json',...headers},body}) as VercelRequest
const house='20000000-0000-4000-8000-000000000001'
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');vi.stubEnv('OPENAI_API_KEY','')
 mocks.getUser.mockResolvedValue({data:{user:{id:'actor'}},error:null})
 const chain={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{id:'actor',role:'advisor',is_active:true,deleted_at:null},error:null})}
 mocks.from.mockReturnValue(chain);mocks.rpc.mockResolvedValue({data:true,error:null});mocks.admin.mockReturnValue({})
})
describe('Student loan API boundaries',()=>{
 it('rejects cross-origin calls before opening a session or admin client',async()=>{
  const res=response();await studentLoanHandler(request({action:'workspace'},{origin:'https://untrusted.example'}),res as unknown as VercelResponse)
  expect(res.statusCode).toBe(403);expect(mocks.getUser).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled()
 })
 it('requires an authenticated session',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:null},error:null});const res=response();await studentLoanHandler(request({action:'workspace'}),res as unknown as VercelResponse)
  expect(res.statusCode).toBe(401);expect(mocks.admin).not.toHaveBeenCalled()
 })
 it('does not construct an admin client for an inaccessible household',async()=>{
  mocks.rpc.mockResolvedValue({data:false,error:null});const res=response();await studentLoanHandler(request({action:'read',householdId:house}),res as unknown as VercelResponse)
  expect(res.statusCode).toBe(404);expect(mocks.admin).not.toHaveBeenCalled()
 })
 it('reports provider setup honestly while serving the authorized household queue',async()=>{
  mocks.rpc.mockResolvedValue({data:[],error:null});const res=response();await studentLoanHandler(request({action:'workspace'}),res as unknown as VercelResponse)
  expect(res.statusCode).toBe(200);expect(res.body).toEqual({ok:true,households:[],aiConfigured:false});expect(mocks.admin).not.toHaveBeenCalled()
 })
 it('rejects unknown action parameters including attempts to approve or supply an actor identity',async()=>{
  for(const body of [{action:'approve',householdId:house},{action:'workspace',actorId:'liz'}]){const res=response();await studentLoanHandler(request(body),res as unknown as VercelResponse);expect(res.statusCode).toBe(400)}
 })
 it('requires borrower confirmation before storing a file',async()=>{
  const res=response();await studentLoanHandler(request({action:'upload',householdId:house,fileName:'aid.txt',text:'data',authorizationReference:'test',borrowerConfirmed:false}),res as unknown as VercelResponse)
  expect(res.statusCode).toBe(400)
 })
 it('does not allow arbitrary preview domains as trusted origins',()=>expect(trustedLoanOrigin('https://attacker.vercel.app')).toBe(false))
})
