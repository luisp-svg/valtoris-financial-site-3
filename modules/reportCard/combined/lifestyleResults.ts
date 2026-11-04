import { visibleLifestyleQuestions } from './lifestyle.js'
import type { ShortDiagnostic } from '../shortForm/contract.js'
export function lifestyleResults(diagnostic:ShortDiagnostic,locale:'en'|'es'){
 const t=(en:string,es:string)=>locale==='es'?es:en
 const questions=visibleLifestyleQuestions(diagnostic)
 const reported=questions.filter(q=>diagnostic[q.id]!==undefined&&diagnostic[q.id]!=='unknown'&&!(Array.isArray(diagnostic[q.id])&&(diagnostic[q.id] as string[]).includes('unknown'))).map(q=>{
  const value=diagnostic[q.id],values=Array.isArray(value)?value:[value]
  return {id:q.id,label:q.label[locale],value:values.map(v=>q.options?.find(o=>o.value===v)?.label[locale]??String(v)).join(', ')}
 })
 const confirm=questions.filter(q=>!reported.some(row=>row.id===q.id)).map(q=>({id:q.id,label:q.label[locale]}))
 const topics=[{id:'policy',text:t('Confirm policy limits, exclusions, deductibles, and insured property use against current documents.','Confirma límites, exclusiones, deducibles y uso de propiedades con los documentos actuales.')}]
 const assets=Array.isArray(diagnostic.assets)?diagnostic.assets:[]
 if(assets.some(x=>['home','rental'].includes(x)))topics.push({id:'property',text:t('Discuss rebuilding values, renovations, rental use, and separate flood or specialty exposures. Market value is not a rebuilding-cost estimate.','Revisa costos de reconstrucción, renovaciones, uso de alquiler y riesgos de inundación o especiales. El valor de mercado no estima el costo de reconstrucción.')})
 if(diagnostic.umbrella!=='yes')topics.push({id:'umbrella',text:t('Discuss whether an umbrella or excess liability review is appropriate; current needs and underlying policy requirements remain to be confirmed.','Revisa si corresponde evaluar responsabilidad adicional; faltan confirmar necesidades y requisitos de las pólizas base.')})
 if(assets.includes('business'))topics.push({id:'commercial',text:t('Review commercial operations separately from household policies, including business vehicles, employees, contracts, and customer data.','Revisa operaciones comerciales por separado de las pólizas del hogar: vehículos, empleados, contratos y datos de clientes.')})
 if(diagnostic.renewal==='30'||['notice','purchase','change'].includes(String(diagnostic.deadline)))topics.push({id:'timing',text:t('Tell your advisor the exact renewal, notice, closing, or contract date so the review can be prioritized.','Confirma con tu asesor la fecha exacta de renovación, aviso, cierre o contrato para priorizar la revisión.')})
 return {overallScore:null,overallGrade:null,diagnostic,reported,confirm,topics,summary:t('This preliminary review organizes your reported exposures. Policy documents and an advisor review are needed to confirm coverage.','Esta revisión preliminar organiza tus riesgos declarados. Se necesitan documentos y revisión del asesor para confirmar cobertura.')}
}
