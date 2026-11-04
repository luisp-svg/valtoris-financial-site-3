import { type Answers, type Specialty } from './catalog.js'
import { report } from './engine.js'
/** Self-reported review findings, separate from sales priority and document verification. */
export function coverageReview(type:Specialty,answers:Answers,locale:'en'|'es'='en'){
 if(type!=='health'&&type!=='benefits')return null
 const es=locale==='es',t=(en:string,spanish:string)=>es?spanish:en
 const r=report(type,answers)
 const dates=['coverage_date','renewal_date'].flatMap(id=>typeof answers[id]==='string'&&answers[id]!=='unknown'?[{id,date:answers[id] as string}]:[])
 const immediate=r.critical.map(q=>({id:q.id,text:q.next[locale]}))
 const actions=[...immediate,...r.review.map(q=>({id:q.id,text:q.next[locale]})),...r.unknown.map(q=>({id:q.id,text:q.next[locale]})),
  {id:'documents',text:t('Prepare current coverage summaries and renewal notices for private verification.','Prepara resúmenes y avisos de renovación para verificación privada.')},
  {id:'compare',text:t('Compare suitable alternatives alongside keeping the current coverage.','Compara alternativas adecuadas junto con mantener cobertura actual.')},
  {id:'service',text:t('Agree on a service contact, next action, and renewal plan.','Acuerda contacto de servicio, próximo paso y plan de renovación.')}]
 const unique=actions.filter((a,i)=>actions.findIndex(b=>b.id===a.id)===i).slice(0,3)
 return {verification:'self_reported' as const,verificationLabel:t('Self-reported · documents not verified','Declarado por ti · documentos sin verificar'),
  coverageStatus:type==='benefits'&&answers.employees==='0'?t('No workforce benefits review applies','No aplica revisión de beneficios de empleados'):immediate.length?t('Priority issues to confirm','Asuntos prioritarios por confirmar'):t('Coverage adequacy needs document review','La suficiencia requiere revisar documentos'),
  readiness:{known:r.answered.length,total:r.answered.length+r.unknown.length,missing:r.unknown.map(q=>q.label[locale])},
  dates,urgent:immediate,actions:unique,
  // Operational routing only: no income, wealth, age, diagnosis or purchasing-power score.
  internal:{priority:immediate.length?'prompt_review':'standard_review',reason:immediate.map(a=>a.id),nextAction:unique[0]?.text,
   householdReviewRequested:type==='benefits'&&answers.personal_review==='yes',employerReviewRequested:type==='health'&&answers.business_review==='yes',
   businessLinked:type==='health'&&['solo','employer'].includes(String(answers.owner_status)),renewalDates:dates}}
}
/** Private advisor worksheet. Never treat a public self-report as verified plan terms. */
export function annualCostScenario(monthlyPremium:number,expectedCoveredCostSharing:number,annualCoveredMaximum:number){
 if([monthlyPremium,expectedCoveredCostSharing,annualCoveredMaximum].some(n=>!Number.isFinite(n)||n<0)||expectedCoveredCostSharing>annualCoveredMaximum)throw new Error('invalid_cost_scenario')
 return {annualPremium:monthlyPremium*12,expectedYear:monthlyPremium*12+expectedCoveredCostSharing,difficultYearCovered:monthlyPremium*12+annualCoveredMaximum,
  excludes:['Noncovered services','Some out-of-network charges','Separate or nonapplicable limits; Original Medicare requires a separate review']}
}

export function publicCoverageReview(type:Specialty,answers:Answers,locale:'en'|'es'='en'){
 const review=coverageReview(type,answers,locale)
 if(!review)return null
 const {internal:_internal,...summary}=review
 return summary
}
