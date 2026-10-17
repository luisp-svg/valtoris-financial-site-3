import { scoreBuyerReadiness } from '../shortForm/buyerReadiness.js'
import { Answers, Copy, Specialty } from './catalog.js'
import { visibleQuestions, valid } from './engine.js'
export type GradeMeasure={id:string;label:Copy;score:number|null;rule:Copy;weight?:number}
export type ReportGrade={score:number|null;letter:string|null;provisional:boolean;notApplicable:boolean;measures:GradeMeasure[]}
const c=(en:string,es:string):Copy=>({en,es})
export const letterGrade=(score:number)=>score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F'
/** Review-only educational rubric v1. No calibrated financial, credit, eligibility, or tax model. */
export function gradeReport(type:Specialty,answers:Answers):ReportGrade{
 const active=visibleQuestions(type,answers)
 const measures:GradeMeasure[]=[]
 const add=(id:string,en:string,es:string,points:Record<string,number>,ruleEn:string,ruleEs:string)=>{
  const q=active.find(q=>q.id===id)
  if(!q)return
  const value=answers[id]
  const score=valid(q,value)&&typeof value==='string'&&value!=='unknown'?points[value]??null:null
  measures.push({id,label:c(en,es),score,rule:c(ruleEn,ruleEs)})
 }
 const yes=(id:string,en:string,es:string)=>add(id,en,es,{yes:100,no:0},'Yes = 100; no = 0. Unknown is unscored.','Sí = 100; no = 0. Desconocido no se puntúa.')
 const review=(id:string,en:string,es:string)=>add(id,en,es,{current:100,year:100,older:50,never:0},'Reviewed in past year = 100; older = 50; never = 0. This is a draft recency rule, not a legal deadline.','Revisado en último año = 100; antes = 50; nunca = 0. Es un criterio de actualidad propuesto, no plazo legal.')
 if(type==='health'){
  if(answers.purpose==='supplemental'){
   yes('supplement_review','Existing benefits and overlap reviewed','Beneficios existentes y superposición revisados')
   add('supplement_terms','Policy terms understood','Términos de póliza comprendidos',{yes:100,partial:50,no:0},'Terms understood = 100; partly understood = 50; not reviewed = 0. No product is required to earn points.','Términos comprendidos = 100; parcialmente = 50; sin revisar = 0. No se exige producto para ganar puntos.')
   add('supplement_budget','Additional premium reviewed','Prima adicional revisada',{yes:100,difficult:0,no:50},'Reviewed and manageable = 100; not checked = 50; difficult = 0. This is a comparison-preparation grade, not policy approval.','Revisada y manejable = 100; sin revisar = 50; difícil = 0. Califica preparación para comparar, no aprobación.')
  }else{
   add('coverage','Major medical coverage continuity','Continuidad de cobertura médica mayor',{all:100,some:0,none:0},'Everyone covered = 100; any reported uninsured person = 0 for this check. Any gap is also flagged separately. Unknown is unscored.','Todos cubiertos = 100; alguna persona sin seguro = 0 en esta medida. Una brecha también se señala por separado. Desconocido sin puntuar.')
   if(answers.afford!=='no_premium')add('afford','Premium affordability','Asequibilidad de primas',{comfortable:100,difficult:50,unmanageable:0},'Comfortable = 100; difficult = 50; cannot maintain = 0. No premium is excluded.','Cómoda = 100; difícil = 50; no puede mantenerse = 0. Sin prima se excluye.')
   add('cost_understanding','Cost-sharing understanding','Comprensión de costos compartidos',{yes:100,partial:50,no:0},'Reviewed = 100; partly understood = 50; not understood = 0.','Revisado = 100; parcialmente comprendido = 50; sin comprender = 0.')
   if(answers.access!=='na')add('access','Relevant provider access','Acceso a proveedores relevantes',{yes:100,problem:0,no:50},'Confirmed = 100; not checked = 50; known access problem = 0. No particular provider is excluded.','Confirmado = 100; sin revisar = 50; problema conocido = 0. Sin proveedor particular se excluye.')
   if(answers.prescriptions!=='na')add('prescriptions','Regular prescription coverage','Cobertura de medicamentos regulares',{yes:100,problem:0,no:50},'Confirmed = 100; not checked = 50; known problem = 0. No regular prescriptions is excluded.','Confirmada = 100; sin revisar = 50; problema conocido = 0. Sin medicamentos regulares se excluye.')
   const weights:Record<string,number>={coverage:30,afford:15,cost_understanding:15,access:20,prescriptions:20}
   for(const measure of measures)measure.weight=weights[measure.id]
  }
 }
 if(type==='tsp'){
  yes('inherited_records','Inherited account records reviewed','Registros de cuenta heredada revisados')
  yes('inherited_options','Beneficiary options and deadlines understood','Opciones y plazos de beneficiario comprendidos')
  yes('income_review','Income and essential-spending coordination','Coordinación de ingresos y gastos esenciales')
  yes('healthcare_review','Healthcare and survivor coordination','Coordinación de salud y sobrevivientes')
  yes('beneficiaries','Beneficiary and survivor review','Revisión de beneficiarios y sobrevivientes')
  yes('options','Comparison of available options','Comparación de opciones disponibles')
 }
 if(type==='benefits')review('review','Benefits cost and payroll review','Revisión de costos de beneficios y nómina')
 if(type==='tax'){
  add('support','Planning support','Apoyo de planificación',{planning:100,filing:50,none:0},'Proactive planning = 100; filing only = 50; no regular support = 0. Does not measure tax savings.','Planificación proactiva = 100; solo declaración = 50; sin apoyo = 0. No mide ahorros fiscales.')
  yes('payments_review','Current tax payments reviewed','Pagos fiscales actuales revisados')
  yes('records_ready','Records ready for a review','Registros listos para revisión')
 }
 if(type==='family'||type==='business'){
  add('cash_flow','Reported cash-flow position','Situación de flujo de efectivo',{positive:100,break_even:50,negative:0},'Usually saving = 100; breaking even = 50; falling short = 0.','Normalmente ahorra = 100; equilibrio = 50; déficit = 0.')
  if(type==='family')yes('disability','Income protection arrangement','Arreglo de protección de ingresos')
  else{yes('separation','Separate business finances','Finanzas del negocio separadas');yes('continuity','Owner continuity preparedness','Preparación para continuidad sin dueño');review('tax_review','Tax planning review','Revisión de planificación fiscal')}
 }
 if(type==='protection')yes('review_current','Protection needs reviewed','Necesidades de protección revisadas')
 if(type==='retirement'){
  add('healthcare','Healthcare funding plan','Plan de financiamiento de salud',{ready:100,partial:50,none:0},'Reviewed plan = 100; partial = 50; no plan = 0.','Plan revisado = 100; parcial = 50; sin plan = 0.')
  yes('income_review','Income and essential spending reviewed','Ingresos y gastos esenciales revisados')
 }
 if(type==='credit'){
  review('review','Credit reports reviewed','Reportes de crédito revisados')
  // This card uses its own source option names.
  const r=measures.find(m=>m.id==='review');if(r&&answers.review==='recent')r.score=100
  add('minimums','Payment manageability','Manejo de pagos',{comfortable:100,tight:50,unmanageable:0},'Comfortable = 100; tight = 50; cannot keep up = 0.','Cómodo = 100; ajustado = 50; no puede pagar = 0.')
  add('overdue','Payments current','Pagos al día',{no:100,yes:0},'No overdue accounts reported = 100; overdue = 0. Not a bureau credit score.','Sin cuentas vencidas declaradas = 100; vencidas = 0. No es un puntaje de buró.')
 }
 if(type==='student_loan'){
  add('payments','Payment history','Historial de pagos',{on_time:100,late:50,missed:0,not_due:100},'On time or none due = 100; late = 50; missed = 0. No payment due is not proof of future affordability.','Al día o sin pago debido = 100; atrasado = 50; omitido = 0. Sin pago debido no prueba asequibilidad futura.')
  add('manageable','Required payment manageability','Manejo del pago obligatorio',{comfortable:100,tight:50,unmanageable:0,not_due:100},'Comfortable or none due = 100; difficult = 50; cannot keep up = 0.','Cómodo o sin pago debido = 100; difícil = 50; no puede pagar = 0.')
 }
 if(type==='home_buyer'){
  const buyer=scoreBuyerReadiness(answers)
  if(buyer){
   const labels:Record<string,Copy>={credit:c('Credit preparation','Preparación de crédito'),debt_budget:c('Debt and housing budget','Deuda y presupuesto de vivienda'),purchase_funds:c('Purchase funds','Fondos de compra'),employment:c('Employment tenure','Antigüedad laboral'),documents:c('Document preparation','Preparación de documentos')}
   for(const category of buyer.categories)measures.push({id:category.id,label:labels[category.id],score:category.score===null?null:Math.round(category.score/category.max*100),rule:c(`Existing Home Buyer rubric: this category has up to ${category.max} points. See the existing buyer review for its detailed criteria.`,`Criterios existentes de vivienda: esta categoría tiene hasta ${category.max} puntos. Consulta la revisión existente para criterios detallados.`)})
   const known=buyer.categories.filter(m=>m.score!==null),max=known.reduce((n,m)=>n+m.max,0)
   const score=max?Math.round(known.reduce((n,m)=>n+(m.score??0),0)/max*100):null
   return {score,letter:score===null?null:letterGrade(score),provisional:buyer.provisional,notApplicable:false,measures}
  }
 }
 const known=measures.filter(m=>m.score!==null)
 const weight=known.reduce((n,m)=>n+(m.weight??1),0)
 const score=weight?Math.round(known.reduce((n,m)=>n+(m.score??0)*(m.weight??1),0)/weight):null
 const notApplicable=type==='benefits'&&answers.employees==='0'
 return {score:notApplicable?null:score,letter:notApplicable||score===null?null:letterGrade(score),provisional:!notApplicable&&(known.length!==measures.length||known.length===0||type==='health'&&(!answers.purpose||answers.purpose==='unknown')),notApplicable,measures}
}
