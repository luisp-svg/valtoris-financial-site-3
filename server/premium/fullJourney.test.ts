import {afterAll,beforeAll,beforeEach,afterEach,expect,it,vi} from 'vitest'
import {LocalTacSandbox} from './localSandbox'
import {initializeProductionBookingFixture,bookingFixtureAdmin} from './productionBookingFixture'
import {SupabaseTacBookingStore} from './tacBookingStore'
import {productionBookingHarness,call} from './productionBookingTestHarness'
import {PRIORITIES,type Priority} from '../../modules/reportCard/combined/engine'
import {mapPublicFamilyDiagnosticDetail} from '../../crm/households/assessments/diagnosticFormatters'
let sandbox:LocalTacSandbox,store:SupabaseTacBookingStore,helpers:ReturnType<typeof productionBookingHarness>
beforeAll(async()=>{sandbox=new LocalTacSandbox();await sandbox.initialize(process.cwd());await initializeProductionBookingFixture(sandbox,process.cwd());store=new SupabaseTacBookingStore(bookingFixtureAdmin(sandbox));helpers=productionBookingHarness(sandbox,store)},30000)
afterAll(async()=>{await sandbox.db.close()})
beforeEach(()=>vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network forbidden')})))
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals()})
const cases=PRIORITIES.flatMap(p=>[{name:p.id+' new',selected:[p.id],existing:false},{name:p.id+' existing',selected:[p.id],existing:true},{name:p.id+' combined',selected:[p.id,p.id==='family'?'protection':'family'],existing:false}])
it.each(cases)('$name follows production TAC booking HTTP and SQL without a second export path',async({selected,existing})=>{
 const f=await helpers.setup(selected as Priority[],existing)
 expect((await call(f,'save',f.body)).status).toBe(200)
 expect((await call(f,'report')).status).toBe(423)
 const body={submissionId:f.journey.id,startTime:f.start,timezone:'UTC'}
 expect((await call(f,'book',body)).status).toBe(200)
 expect((await call(f,'book',body)).status).toBe(200)
 expect((await call(f,'report')).body.results).toHaveLength(selected.length)
 const b=(await store.load(f.journey.id))!,saved=(await sandbox.load(f.journey.id))!
 expect((await sandbox.db.query('SELECT * FROM appointments WHERE id=$1',[b.appointment_id])).rows).toHaveLength(1)
 expect((await sandbox.db.query('SELECT * FROM integration_contact_links WHERE household_member_id=$1',[b.member_id])).rows).toHaveLength(1)
 expect((await sandbox.db.query('SELECT * FROM insurance_quote_deliveries WHERE lead_id=$1',[b.lead_id])).rows).toHaveLength(0)
 expect(f.provider.createContact).toHaveBeenCalledTimes(existing?0:1)
 expect(f.provider.createEvent).toHaveBeenCalledTimes(1)
 const detail=mapPublicFamilyDiagnosticDetail({id:saved.id,assessment_type:'family',capture_channel:'public_self_report',status:'completed',completed_at:saved.submittedAt,answers:saved.answers,derived_metrics:saved.derived,scoring_version:5,overall_score:null,overall_grade:null},'local',null)
 expect(detail?.combinedReports).toHaveLength(selected.length);expect(detail?.bookingVerifiedAt).toBeTruthy()
 f.cancel();expect((await call(f,'report')).status).toBe(423)
},30000)
