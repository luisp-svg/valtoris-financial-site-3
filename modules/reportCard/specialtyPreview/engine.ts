import { Answers, Copy, Question, SPECIALTY_CARDS, Specialty } from './catalog.js'
const knownNumber=(value:unknown):number|null=>typeof value==='string'&&value.trim()!==''&&value!=='unknown'&&Number.isFinite(Number(value))?Number(value):null
const unknown=(value:unknown)=>value==='unknown'||Array.isArray(value)&&value.includes('unknown')
export function visibleQuestions(type:Specialty,answers:Answers){
 const matches=(field:string,values:readonly string[])=>values.some(option=>option==='positive'?(knownNumber(answers[field])??0)>0:Array.isArray(answers[field])?(answers[field] as string[]).includes(option):answers[field]===option)
 return SPECIALTY_CARDS[type].questions.filter(q=>{
  if(q.whenAny&&!q.whenAny.some(condition=>matches(condition.field,condition.values)))return false
  if(q.whenAll&&!q.whenAll.every(condition=>matches(condition.field,condition.values)))return false
  if(!q.when)return true
  const value=answers[q.when.field]
  if(q.when.not!==undefined)return value!==undefined&&!unknown(value)&&value!==q.when.not
  return matches(q.when.field,q.when.values??[])
 })
}
export function valid(q:Question,value:unknown):boolean{
 if(value==='unknown')return true
 if(q.kind==='multi')return Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(v=>q.options?.some(o=>o[0]===v))&&!(value.length>1&&value.includes('none'))
 if(typeof value!=='string'||!value.trim())return false
 if(q.kind==='choice')return !!q.options?.some(o=>o[0]===value)
 const n=knownNumber(value)
 return n!==null&&n>=(q.min??0)&&n<=(q.max??1e9)&&(!q.integer||Number.isInteger(n))
}
export function update(type:Specialty,answers:Answers,id:string,value:string|string[]){
 if(!visibleQuestions(type,answers).some(q=>q.id===id))return answers
 let next={...answers,[id]:value}
 for(let i=0;i<SPECIALTY_CARDS[type].questions.length;i++){
  const active=new Set(visibleQuestions(type,next).map(q=>q.id));const clean=Object.fromEntries(Object.entries(next).filter(([key])=>active.has(key)))
  if(Object.keys(clean).length===Object.keys(next).length)return clean
  next=clean
 }
 return next
}
export function toggle(current:string|string[]|undefined,value:string):string[]{
 const values=Array.isArray(current)?current:[]
 if(value==='none')return values.includes('none')?[]:['none']
 const selected=values.filter(v=>v!=='none')
 return selected.includes(value)?selected.filter(v=>v!==value):[...selected,value]
}
export function error(type:Specialty,answers:Answers):string|null{
 if(type==='benefits'||type==='tax'){
  const total=knownNumber(answers.employees),full=knownNumber(answers.fulltime),covered=knownNumber(answers.covered)
  if(total!==null&&full!==null&&full>total)return 'counts'
  if(full!==null&&covered!==null&&covered>full)return 'coverage_counts'
 }
 if(type==='retirement'){
  const age=knownNumber(answers.age),target=knownNumber(answers.target_age)
  if(age!==null&&target!==null&&target<age)return 'retirement_age'
 }
 return null
}
export type Pathway={id:string;title:Copy;detail:Copy}
const c=(en:string,es:string):Copy=>({en,es})
export function pathways(type:Specialty,answers:Answers):Pathway[]{
 const out:Pathway[]=[]
 const add=(id:string,en:string,es:string,detailEn:string,detailEs:string)=>out.push({id,title:c(en,es),detail:c(detailEn,detailEs)})
 if(type==='tsp'){
  const inherited=answers.goal==='beneficiary'||answers.service==='beneficiary'
  if(inherited)add('tsp_beneficiary','Beneficiary account review','Revisión de cuenta de beneficiario','Confirm inherited-account status, documents, distribution options, and deadlines with TSP and a qualified specialist. This report does not select a distribution.','Confirma estado heredado, documentos, opciones y plazos con TSP y un especialista. El informe no elige una distribución.')
  else if(answers.goal==='compare'&&answers.account==='yes')add('tsp_compare','Compare keeping TSP with alternatives','Comparar mantener TSP con alternativas','Use a documented comparison of fees, services, liquidity, taxes, benefits, and restrictions. Keeping the account is an explicit option; no rollover is recommended here.','Usa comparación documentada de cargos, servicios, liquidez, impuestos, beneficios y restricciones. Mantener la cuenta es una opción explícita; no se recomienda transferencia.')
  else if(answers.goal==='income')add('tsp_income','Coordinate the federal retirement plan','Coordinar el plan de jubilación federal','Confirm pension, Social Security, TSP, healthcare, survivor choices, and essential spending in one planning conversation.','Confirma pensión, Seguro Social, TSP, salud, sobrevivientes y gastos esenciales en una conversación.')
  else add('tsp_education','Understand the current account and decisions','Entender la cuenta y decisiones actuales','Start with official records, account access, and your stated questions. An educational review does not require moving money.','Comienza con registros oficiales, acceso y tus preguntas. Una revisión educativa no requiere mover dinero.')
 }
 if(type==='benefits'&&['start_group','review_group','costs','unsure'].includes(String(answers.purpose))&&(knownNumber(answers.employees)??0)>0)add('group_health','Group health coverage review','Revisión de cobertura de salud grupal','Compare the current arrangement, employee and dependent needs, contributions, locations, and start or renewal date. This is a group-health conversation, separate from DCBG’s supplemental wellness offering.','Compara arreglo actual, necesidades de empleados y dependientes, aportes, ubicaciones y fechas. Es una conversación de salud grupal, separada de la oferta complementaria de bienestar de DCBG.')
 if(type==='benefits'||type==='tax'){
  const full=knownNumber(answers.fulltime),covered=knownNumber(answers.covered)
  if((type!=='benefits'||['add','costs','unsure','unknown'].includes(String(answers.purpose)))&&full!==null&&full>=5&&covered!==null&&covered>=5)add('dcbg','Employer benefits and payroll review','Revisión de beneficios y nómina','Your reported counts suggest a DCBG discussion may be relevant. DCBG must confirm full-time definitions, coverage requirements, current plan terms, costs, and payroll treatment. No eligibility or savings are established.','Tus cifras sugieren que una conversación con DCBG podría ser relevante. DCBG debe confirmar definiciones, requisitos de cobertura, términos, costos y tratamiento en nómina. No se establece elegibilidad ni ahorro.')
  else if((knownNumber(answers.employees)??0)>0)add('benefits_general','General employer benefits review','Revisión general de beneficios','Review workforce needs and confirm employee coverage. The information does not establish fit for DCBG’s published program; broader benefits options can still be discussed.','Revisa necesidades del equipo y confirma cobertura. La información no establece compatibilidad con el programa publicado de DCBG; aún se pueden conversar opciones generales.')
 }
 if(type==='tax'){
  if(['owner','both'].includes(String(answers.situation))){
   add('xtra','Business accounting and year-round planning','Contabilidad y planificación anual del negocio','Consider an XTRA-style conversation about bookkeeping, tax coordination, and owner decisions. A specialist must confirm the scope and engagement.','Considera una conversación del tipo XTRA sobre contabilidad, coordinación fiscal y decisiones del dueño. Un especialista debe confirmar el alcance.')
   if(answers.revenue==='600plus')add('crown','Coordinated business tax architecture','Estructura fiscal coordinada del negocio','Your reported revenue meets the published $600,000 revenue marker for a Crown discussion. Revenue is not profit; complexity, tax exposure, and partner acceptance still require review.','Tus ingresos declarados alcanzan el marcador publicado de $600,000 para conversar sobre Crown. Ingresos no son utilidad; complejidad, exposición fiscal y aceptación requieren revisión.')
  }
  if(['employee','both'].includes(String(answers.situation))&&answers.w2_income==='600plus')add('high_w2','High W-2 income planning','Planificación para ingresos W-2 altos','Your W-2 range meets Excel Empire’s published $600,000 marker for this pathway. A specialist must confirm the full situation before any recommendation.','Tu rango W-2 alcanza el marcador publicado de $600,000 para esta ruta. Un especialista debe confirmar la situación completa antes de recomendar.')
  const changes=Array.isArray(answers.changes)?answers.changes:[]
  if(changes.includes('sale_planned')||changes.includes('sale_done'))add('sale','Business or asset-sale planning','Planificación de venta de negocio o activo',changes.includes('sale_done')?'A completed sale needs review of actual facts and deadlines. Do not assume a pre-sale strategy remains available.':'Discuss the proposed sale before signing or closing; timing and the asset details matter.',changes.includes('sale_done')?'Una venta completada requiere revisar hechos y fechas. No supongas que una estrategia previa a la venta sigue disponible.':'Habla de la venta antes de firmar o cerrar; importan fechas y detalles del activo.')
  if(changes.includes('retirement')&&answers.pretax==='500plus')add('roth','Retirement tax and Roth comparison','Comparación de impuestos de jubilación y Roth','The reported range reaches the published $500,000 asset marker, but movable assets have not been verified. Access restrictions, taxes, fees, and alternatives need specialist review. No conversion or transfer is recommended.','El rango alcanza el marcador publicado de $500,000, pero no se verificaron activos transferibles. Restricciones, impuestos, cargos y alternativas requieren revisión. No se recomienda conversión ni transferencia.')
 }
 return out
}
export function report(type:Specialty,answers:Answers){const active=visibleQuestions(type,answers);const missing=active.filter(q=>!valid(q,answers[q.id])||unknown(answers[q.id]));return {
 confirmations:missing.map(q=>q.next),
 critical:type==='health'?active.filter(q=>q.id==='coverage'&&['some','none'].includes(String(answers.coverage))||q.id==='afford'&&answers.afford==='unmanageable'||q.id==='access'&&answers.access==='problem'||q.id==='prescriptions'&&answers.prescriptions==='problem'||q.id==='timing'&&['past','soon'].includes(String(answers.timing))):[],
 unknown:active.filter(q=>!valid(q,answers[q.id])||unknown(answers[q.id])),
 review:active.filter(q=>q.reviewValues?.some(v=>Array.isArray(answers[q.id])?(answers[q.id] as string[]).includes(v):answers[q.id]===v)),
 answered:active.filter(q=>valid(q,answers[q.id])&&!unknown(answers[q.id])),
 noEmployees:(type==='benefits'||type==='tax')&&answers.employees==='0',noTsp:type==='tsp'&&answers.account==='no',pathways:error(type,answers)?[]:pathways(type,answers)
}}
