import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { beforeAll,afterAll,beforeEach,afterEach,it,expect,vi } from 'vitest'
import { LocalTacSandbox } from './localSandbox'
import { runLocalJourney } from './localSandboxJourney'
import { combinedFixture } from './testFixtures'
import { PRIORITIES,type Priority } from '../../modules/reportCard/combined/engine'
let sandbox:LocalTacSandbox,dir:string
beforeAll(async()=>{dir=await mkdtemp(tmpdir()+'/valtoris-tac-qa-');sandbox=new LocalTacSandbox(dir);await sandbox.initialize(process.cwd())},30000)
afterAll(async()=>{await sandbox.db.close();await rm(dir,{recursive:true,force:true})})
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network is forbidden in local TAC verification')}))})
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals()})
const cases=PRIORITIES.flatMap(p=>[{label:p.id+' new',selected:[p.id],existing:false},{label:p.id+' existing',selected:[p.id],existing:true},{label:p.id+' combined',selected:[p.id,p.id==='family'?'protection':'family'],existing:false}])
it.each(cases)('$label persists contact -> review -> internal task -> booking -> TAC without duplicate records',async({label,selected,existing})=>{const result=await runLocalJourney(sandbox,selected as Priority[],label,existing,label.includes('existing')?'es':'en');expect(result.passed).toBe(true)},30000)
it('reopens the same persistent database with test records intact',async()=>{const before=await sandbox.audit();await sandbox.db.close();sandbox=new LocalTacSandbox(dir);await sandbox.initialize(process.cwd());const after=await sandbox.audit();expect(after.counts).toEqual(before.counts);expect(after.outboundEnabled).toBe(false)})

it('rejects real-domain contacts and conflicting identities before writing',async()=>{const a=combinedFixture(['family']);a.contact.email='do-not-store@example.com';await expect(sandbox.seedContact(a)).rejects.toThrow('example.invalid');a.contact.email='family-new@example.invalid';a.contact.phone='+12025550198';await expect(sandbox.seedContact(a)).rejects.toThrow('identity conflict');expect((await sandbox.audit()).counts.local_contacts).toBe(PRIORITIES.length*3)})

it('database blocks a provider appointment without an earlier TAC booking request',async()=>{const contact=(await sandbox.db.query<{id:string}>("SELECT id FROM local_contacts LIMIT 1")).rows[0].id;await expect(sandbox.db.query("INSERT INTO local_bookings(id,contact_id,event) VALUES('orphan-test',$1,'{}')",[contact])).rejects.toThrow();await expect(sandbox.db.query("INSERT INTO local_bookings(id,contact_id,event,tac_request_id) VALUES('orphan-test',$1,'{}','ffffffff-ffff-4fff-8fff-ffffffffffff')",[contact])).rejects.toThrow()})
