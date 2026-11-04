import { normalizePhone } from '../../../crm/households/normalizeContact.js';
import { validQuestion, validShortContact, type ShortDiagnostic } from '../shortForm/contract.js';
import type { ShortQuestion, Locale } from '../shortForm/catalog.js';
import type { PublicReportCardAssessmentType } from '../publicIngestCatalog.js';
import * as legacy from './legacyEngine.js';
export const COMBINED_FORMAT = 'combined-priorities-v2' as const;
export const COMBINED_VERSION = 7;
// Reserve three of the 25 question slots for name, email and phone. Consent is separate.
export const MAX_ASSESSMENT_QUESTIONS = 22;
export const PRIORITIES = [
 {id:'student_loan',en:'Student loans',es:'Préstamos estudiantiles'},
 {id:'health',en:'Health insurance',es:'Seguro de salud'},
 ...legacy.PRIORITIES.filter(p=>!['student_loan','health','lifestyle'].includes(p.id)),
 {id:'lifestyle',en:'Personal P&C — home, auto and property',es:'Seguro personal — hogar, auto y propiedad'},
 {id:'commercial',en:'Commercial insurance',es:'Seguro comercial'},
 {id:'trucking',en:'Commercial trucking insurance',es:'Seguro de transporte comercial'},
] as const;
export type Priority = typeof PRIORITIES[number]['id'];
export type CombinedAnswers = {format:typeof COMBINED_FORMAT | typeof legacy.COMBINED_FORMAT;insuranceRoutingVersion?:1;consultationOnly?:true;selected:Priority[];diagnostic:ShortDiagnostic;contact:{fullName:string;email:string;phone:string};locale:Locale};
export type CombinedQuestion = {id:string;question:ShortQuestion;reviews:Priority[]};
export const PRIORITY_GROUPS: {en:string;es:string;ids:Priority[]}[] = [
 {en:'Start here: student loans & health',es:'Comienza aquí: préstamos y salud',ids:['student_loan','health']},
 {en:'Family, income & property',es:'Familia, ingresos y propiedad',ids:['family','protection','lifestyle']},
 {en:'Credit, home & future planning',es:'Crédito, vivienda y futuro',ids:['credit','home_buyer','retirement','tsp','tax']},
 {en:'Business & workforce',es:'Negocio y empleados',ids:['business','commercial','trucking','benefits']},
];
const c=(en:string,es:string)=>({en,es});
const option=(value:string,en:string,es:string)=>({value,label:c(en,es)});
function choice(id:string,en:string,es:string,options:ReturnType<typeof option>[]):ShortQuestion{return {id,label:c(en,es),kind:'select',options:[...options,option('unknown','Not sure / prefer to discuss','No sé / prefiero conversar')]};}
const preparedness=[option('current','Current and reviewed','Actualizado y revisado'),option('partial','Partly addressed / needs updating','Parcial / requiere actualización'),option('missing','Not yet addressed','Aún no se ha atendido')];
// Each category has a concrete status check and a distinct planning check. Unknown never means zero.
const checks:Record<Priority,[string,string,string,string]>={
 family:['If your household lost its main income, how long could accessible savings cover essential bills?','Si tu hogar perdiera su ingreso principal, ¿cuánto durarían los ahorros para gastos esenciales?','Have you reviewed life coverage, beneficiaries and family obligations in the past year?','¿Revisaste cobertura de vida, beneficiarios y obligaciones familiares en el último año?'],
 protection:['Do you have a way to replace income if illness or injury prevents you from working?','¿Tienes una forma de reemplazar ingresos si una enfermedad o lesión te impide trabajar?','Have you compared income replacement benefits with your essential monthly expenses?','¿Comparaste los beneficios de reemplazo de ingresos con tus gastos esenciales?'],
 lifestyle:['Are your home or rental property and personal vehicles currently insured?','¿Tu vivienda o propiedad alquilada y vehículos personales tienen seguro vigente?','Have you reviewed personal policy limits, deductibles and renewal dates in the past year?','¿Revisaste límites, deducibles y fechas de renovación de tus pólizas personales en el último año?'],
 business:['Are business accounts, records and owner finances kept separate?','¿Mantienes separadas las cuentas del negocio y las finanzas del dueño?','Is there a documented plan for the business to operate if its owner is unavailable?','¿Existe un plan documentado para operar si el dueño no está disponible?'],
 commercial:['Does your business have current liability and property coverage for its operations?','¿Tu negocio tiene cobertura vigente de responsabilidad y propiedad para sus operaciones?','Have operations, employees and contractual insurance requirements been reviewed against your policies?','¿Se compararon operaciones, empleados y requisitos de contratos con las pólizas?'],
 trucking:['Do all operating trucks have current commercial auto liability coverage?','¿Todos los camiones operativos tienen cobertura vigente de responsabilidad de auto comercial?','Have cargo, operating radius, drivers and required filings been reviewed with your agent?','¿Revisaste carga, radio de operación, conductores y registros requeridos con tu agente?'],
 health:['What is your current health insurance situation?','¿Cuál es tu situación actual de seguro de salud?','Have you checked doctors, prescriptions and total out-of-pocket costs against your current needs?','¿Revisaste médicos, recetas y costos de bolsillo según tus necesidades actuales?'],
 student_loan:['What is the current status of your student loans?','¿Cuál es el estado actual de tus préstamos estudiantiles?','Have you reviewed current servicer records, loan types and repayment options?','¿Revisaste registros actuales del administrador, tipos de préstamo y opciones de pago?'],
 credit:['What best describes your current credit payment history?','¿Qué describe mejor tu historial actual de pagos de crédito?','Have you reviewed your credit reports for errors and high balances?','¿Revisaste tus informes de crédito por errores y saldos altos?'],
 home_buyer:['Have you set aside funds for a down payment, closing costs and reserves?','¿Reservaste fondos para enganche, cierre y reservas?','Have you reviewed an affordable payment budget and financing requirements with a lender?','¿Revisaste presupuesto de pago y requisitos de financiamiento con un prestamista?'],
 retirement:['Do you have a written retirement income and spending plan?','¿Tienes un plan escrito de ingresos y gastos de jubilación?','Have you reviewed retirement beneficiaries, healthcare costs and legacy documents?','¿Revisaste beneficiarios, costos médicos y documentos de legado?'],
 tsp:['Have you reviewed your TSP allocation against your retirement timeline?','¿Revisaste tu asignación TSP según tu fecha de jubilación?','Have you reviewed TSP beneficiaries, federal benefits and withdrawal planning together?','¿Revisaste juntos beneficiarios TSP, beneficios federales y planificación de retiros?'],
 benefits:['Does your business currently offer benefits to its employees?','¿Tu negocio ofrece beneficios actualmente a sus empleados?','Have you reviewed employee needs, employer costs and benefits renewal dates?','¿Revisaste necesidades de empleados, costos del empleador y renovaciones de beneficios?'],
 tax:['Are your financial and business records organized for a tax professional?','¿Tus registros financieros y del negocio están organizados para un profesional fiscal?','Have you reviewed planning questions with a qualified tax professional in the past year?','¿Revisaste preguntas de planificación con un profesional fiscal en el último año?'],
};
export function isPriority(v:unknown):v is Priority{return typeof v==='string'&&PRIORITIES.some(p=>p.id===v);}
export function orderedPriorities(s:readonly Priority[]):Priority[]{return PRIORITIES.filter(p=>s.includes(p.id)).map(p=>p.id);}
export function primaryAssessment(s:readonly Priority[]):PublicReportCardAssessmentType{
 // Keep the existing CRM parent taxonomy. Distinct commercial/trucking service IDs live in selectedPriorities.
 const old=s.filter((p):p is legacy.Priority=>p!=='commercial'&&p!=='trucking');
 return old.length ? legacy.primaryAssessment(old) : 'business';
}
export function isCombined(v:unknown):v is CombinedAnswers{return !!v&&typeof v==='object'&&[COMBINED_FORMAT,legacy.COMBINED_FORMAT].includes((v as CombinedAnswers).format);}
export function combinedQuestions(selected:readonly Priority[],answers:ShortDiagnostic,insuranceRoutingVersion?:1):CombinedQuestion[]{
 const types=orderedPriorities(selected);if(!types.length)return [];
 const out:CombinedQuestion[]=[];
 const add=(question:ShortQuestion,reviews:Priority[])=>out.push({id:question.id,question,reviews});
 add(choice('shared.state','Where do you live or primarily operate?','¿Dónde vives u operas principalmente?',[]),types);
 // State uses the established validated state selector.
 out[0].question={id:'shared.state',label:c('Where do you live or primarily operate?','¿Dónde vives u operas principalmente?'),kind:'state'};
 add(choice('shared.timing','When would you like help?','¿Cuándo deseas ayuda?',[option('immediately','Immediately','Inmediatamente'),option('month','Within 30 days','En 30 días'),option('later','Just exploring','Solo explorando')]),types);
 for(const type of types){
  const [en,es]=checks[type];
  let options=preparedness;
  if(type==='family') options=[option('current','6 months or more','6 meses o más'),option('partial','1–5 months','1–5 meses'),option('missing','Less than 1 month','Menos de 1 mes')];
  if(type==='health') options=[option('current','Covered and meeting my needs','Con cobertura que satisface mis necesidades'),option('partial','Covered but costs or benefits need review','Con cobertura, pero costos o beneficios requieren revisión'),option('missing','Uninsured or losing coverage','Sin cobertura o por perderla')];
  if(type==='student_loan')options=[option('current','Current on payments','Pagos al día'),option('partial','In deferment, forbearance or having payment difficulty','En aplazamiento, indulgencia o con dificultad de pago'),option('missing','Past due or in default','En atraso o incumplimiento')];
  if(type==='credit')options=[option('current','All payments current','Todos los pagos al día'),option('partial','Occasional late payments','Atrasos ocasionales'),option('missing','Past due balances or collections','Saldos vencidos o cobranzas')];
  add(choice(type+'.status',en,es,options),[type]);
 }
 // Explicit optional extension keeps already-saved v2 assessments and their grades readable.
 // Routing is unscored; broad combined reviews keep their original fixed budget.
 if(insuranceRoutingVersion===1&&types.length<=4&&types.some(t=>['lifestyle','commercial','trucking'].includes(t))){
  const insurance=types.filter(t=>['lifestyle','commercial','trucking'].includes(t));
  add(choice('insurance.goal','What brings you to an insurance review?','¿Qué te trae a una revisión de seguros?',[option('new','New coverage or new operation','Nueva cobertura u operación'),option('renewal','Upcoming renewal','Próxima renovación'),option('changes','Changes to property, vehicles or operations','Cambios en bienes, vehículos u operaciones'),option('compare','Compare current protection','Comparar protección actual')]),insurance);
  add(choice('insurance.renewal','When is your next policy renewal or required start?','¿Cuándo es tu próxima renovación o inicio requerido?',[option('30_days','Within 30 days','En 30 días'),option('90_days','In 31–90 days','En 31–90 días'),option('later','More than 90 days away','En más de 90 días'),option('new','No current policy','Sin póliza actual')]),insurance);
  if(types.includes('lifestyle'))add({...choice('lifestyle.assets','What would you like reviewed?','¿Qué deseas revisar?',[option('home','Home or condo','Casa o condominio'),option('renters','Renters coverage','Seguro para inquilinos'),option('auto','Personal vehicles','Vehículos personales'),option('rental','Rental property','Propiedad de alquiler'),option('umbrella','Umbrella or other personal protection','Responsabilidad adicional u otra protección personal')]),kind:'multi'},['lifestyle']);
  if(types.includes('commercial')){
   add(choice('commercial.operation','Which best describes your business?','¿Qué describe mejor tu negocio?',[option('contractor','Contractor or trades','Contratista u oficios'),option('professional','Professional or office services','Servicios profesionales u oficina'),option('retail','Retail, restaurant or hospitality','Comercio, restaurante u hospitalidad'),option('other','Another type of business','Otro tipo de negocio')]),['commercial']);
   add(choice('commercial.people','Does your business have employees?','¿Tu negocio tiene empleados?',[option('owner','Owner only','Solo el dueño'),option('employees','Yes, employees','Sí, empleados'),option('contractors','Independent contractors only','Solo contratistas independientes')]),['commercial']);
  }
  if(types.includes('trucking')){
   add(choice('trucking.operation','How do you operate?','¿Cómo operas?',[option('own_authority','Under my own operating authority','Con mi propia autoridad operativa'),option('leased','Leased to a motor carrier','Arrendado a un transportista'),option('fleet','Fleet or multiple trucks','Flota o varios camiones'),option('starting','Preparing to start operations','Preparándome para operar')]),['trucking']);
   add(choice('trucking.radius','Where do your trucks operate?','¿Dónde operan tus camiones?',[option('local','Local routes','Rutas locales'),option('regional','Regional routes','Rutas regionales'),option('interstate','Across state lines','Entre estados')]),['trucking']);
   add(choice('trucking.cargo','What is the main type of cargo?','¿Cuál es el tipo principal de carga?',[option('general','General freight or dry van','Carga general o caja seca'),option('refrigerated','Refrigerated goods','Productos refrigerados'),option('flatbed','Flatbed or equipment','Plataforma o equipo'),option('specialized','Specialized or other cargo','Carga especializada u otra')]),['trucking']);
  }
 }
 // Fixed membership: branch changes cannot evict already-answered questions.
 const budget=MAX_ASSESSMENT_QUESTIONS-out.length-types.filter(t=>t==='student_loan'||t==='health').length;
 for(const type of types.slice(0,budget)){const [, ,en,es]=checks[type];add(choice(type+'.review',en,es,preparedness),[type]);}
 // Focused funnels get relevant, unscored routing context. All-service flow already uses its budget.
 for(const type of ['student_loan','health'] as const)if(types.includes(type)&&out.length<MAX_ASSESSMENT_QUESTIONS){
  if(type==='student_loan')add(choice('student_loan.loan_type','Which student loans do you have?','¿Qué préstamos estudiantiles tienes?',[option('federal','Federal','Federales'),option('private','Private','Privados'),option('both','Both','Ambos'),option('none','No current student loans','Sin préstamos actuales')]),[type]);
  if(type==='health')add(choice('health.goal','Who needs health coverage?','¿Quién necesita cobertura de salud?',[option('self','Me','Yo'),option('family','My household','Mi hogar'),option('employees','My employees','Mis empleados')]),[type]);
 }
 if(types.includes('health')&&answers['health.status']==='missing'&&out.length<MAX_ASSESSMENT_QUESTIONS)add({...choice('health.coverage_date','When does your coverage end or need to begin?','¿Cuándo termina tu cobertura o debe comenzar?',[]),kind:'date'},['health']);
 if(types.includes('credit')&&out.length<MAX_ASSESSMENT_QUESTIONS)add(choice('credit.goal','What is your main credit goal?','¿Cuál es tu meta principal de crédito?',[option('improve_score','Improve my credit score','Mejorar mi puntaje de crédito'),option('errors','Review errors','Revisar errores'),option('financing','Prepare for financing','Prepararme para financiamiento')]),['credit']);
 const visible=types.includes('student_loan')&&answers['student_loan.loan_type']==='none'?out.filter(q=>!['student_loan.status','student_loan.review'].includes(q.id)):out;
 const rank=(q:CombinedQuestion)=>q.id.startsWith('shared.')?0:['student_loan.loan_type','health.goal','insurance.goal','insurance.renewal','lifestyle.assets','commercial.operation','commercial.people','trucking.operation','trucking.radius','trucking.cargo'].includes(q.id)?1:2;
 return visible.sort((a,b)=>rank(a)-rank(b));
}
export function validCombinedQuestion(q:CombinedQuestion,value:unknown):boolean{if(q.question.kind==='date')return value==='unknown'||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;return validQuestion(q.question,value);}
export function pruneCombined(s:readonly Priority[],d:ShortDiagnostic,insuranceRoutingVersion?:1):ShortDiagnostic{const keys=new Set(combinedQuestions(s,d,insuranceRoutingVersion).map(q=>q.id));return Object.fromEntries(Object.entries(d).filter(([k])=>keys.has(k)));}
export function updateCombined(s:readonly Priority[],d:ShortDiagnostic,id:string,value:string|string[],insuranceRoutingVersion?:1):ShortDiagnostic{return pruneCombined(s,{...d,[id]:value},insuranceRoutingVersion);}
export function validateCombined(raw:unknown,assessmentType?:PublicReportCardAssessmentType):CombinedAnswers|null{
 if(!isCombined(raw))return null;
 if(raw.format===legacy.COMBINED_FORMAT)return legacy.validateCombined(raw,assessmentType);
 if(Object.keys(raw).some(k=>!['format','selected','diagnostic','contact','locale','consultationOnly','insuranceRoutingVersion'].includes(k))||!Array.isArray(raw.selected)||!raw.selected.length||!raw.selected.every(isPriority)||new Set(raw.selected).size!==raw.selected.length||!['en','es'].includes(raw.locale)||!raw.diagnostic||typeof raw.diagnostic!=='object'||Array.isArray(raw.diagnostic)||raw.consultationOnly!==undefined&&raw.consultationOnly!==true)return null;
 if(raw.insuranceRoutingVersion!==undefined&&raw.insuranceRoutingVersion!==1)return null;
 if(assessmentType&&primaryAssessment(raw.selected)!==assessmentType)return null;
 const active=raw.consultationOnly?[]:combinedQuestions(raw.selected,raw.diagnostic,raw.insuranceRoutingVersion);
 if(Object.keys(raw.diagnostic).some(k=>!active.some(q=>q.id===k))||active.some(q=>!validCombinedQuestion(q,raw.diagnostic[q.id])))return null;
 if(!raw.contact||typeof raw.contact!=='object'||Array.isArray(raw.contact)||Object.keys(raw.contact).some(k=>!['fullName','email','phone'].includes(k))||!(['fullName','email','phone'] as const).every(k=>typeof raw.contact[k]==='string')||!validShortContact(raw.contact)||!normalizePhone(raw.contact.phone))return null;
 return {...raw,selected:orderedPriorities(raw.selected),contact:{fullName:raw.contact.fullName.trim(),email:raw.contact.email.trim(),phone:raw.contact.phone.trim()}};
}
export function projectDiagnostic(type:Priority,d:ShortDiagnostic){return type==='commercial'||type==='trucking'?{}:legacy.projectDiagnostic(type,d);}
export function combinedValidationIssue(_s:readonly Priority[],_d:ShortDiagnostic):ReturnType<typeof legacy.combinedValidationIssue>{return null;}
export function restoreStoredCombined(raw:unknown):CombinedAnswers|null{if(isCombined(raw)&&raw.format===COMBINED_FORMAT)return validateCombined(raw);return legacy.restoreStoredCombined(raw);}
export function readStoredCombined(raw:unknown){if(!isCombined(raw))return null;if(raw.format===legacy.COMBINED_FORMAT)return legacy.readStoredCombined(raw);return validateCombined({...raw,contact:{fullName:'Stored Review',email:'stored@example.invalid',phone:'+12025550100'}});}
export function combinedAnswerRows(raw:unknown,locale:Locale='en'){
 if(isCombined(raw)&&raw.format===legacy.COMBINED_FORMAT)return legacy.combinedAnswerRows(raw,locale);
 const saved=readStoredCombined(raw);if(!saved)return [];
 return combinedQuestions(saved.selected,saved.diagnostic,(saved as CombinedAnswers).insuranceRoutingVersion).map(({id,question})=>({id,label:question.label[locale],value:(Array.isArray(saved.diagnostic[id])?saved.diagnostic[id] as string[]:[String(saved.diagnostic[id]??'—')]).map(v=>question.options?.find(o=>o.value===v)?.label[locale]??v).join(', ')}));
}
