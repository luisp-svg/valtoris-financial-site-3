import { PRIORITIES, type Priority } from './engine'

type Locale='en'|'es'
const documents:Record<Priority,[string,string]>={
 family:['household budget, emergency savings summary and beneficiary records','presupuesto familiar, resumen de ahorros de emergencia y beneficiarios'],
 protection:['current protection policies and beneficiary records','pólizas de protección vigentes y beneficiarios'],
 business:['business financial summaries and continuity agreements','resúmenes financieros empresariales y acuerdos de continuidad'],
 retirement:['retirement account statements and expected spending','estados de cuentas de jubilación y gastos previstos'],
 tsp:['TSP statements and federal benefit information','estados del TSP e información de beneficios federales'],
 credit:['current credit reports and account statements','informes de crédito y estados de cuenta actuales'],
 home_buyer:['income records, savings and a housing budget','comprobantes de ingresos, ahorros y presupuesto de vivienda'],
 student_loan:['loan statements, repayment details and relevant notices','estados de préstamos, detalles de pago y avisos pertinentes'],
 health:['current health coverage, enrollment notices and key dates','cobertura médica, avisos de inscripción y fechas importantes'],
 benefits:['an aggregate benefits summary and renewal dates','resumen agregado de beneficios y fechas de renovación'],
 tax:['organized tax records and questions for your tax professional','registros fiscales organizados y preguntas para tu profesional fiscal'],
 lifestyle:['home, auto and property policy summaries and renewal dates','resúmenes de pólizas de hogar, auto y propiedad y fechas de renovación'],
 commercial:['business insurance summaries, operations and renewal dates','resúmenes de seguros comerciales, operaciones y fechas de renovación'],
 trucking:['trucking policy summaries, operating details and renewal dates','resúmenes de seguros de transporte, operaciones y fechas de renovación'],
}
/** Planning prompts only; never changes grades or treats missing answers as confirmed needs. */
export function reportActionPlan(selected:readonly Priority[],locale:Locale){
 const unique=PRIORITIES.filter(p=>selected.includes(p.id))
 return {
  immediate:unique.map(p=>({id:p.id,title:p[locale],text:locale==='es'?`Reúne ${documents[p.id][1]}. Anota información faltante y cualquier plazo próximo para confirmarlo cuanto antes.`:`Gather ${documents[p.id][0]}. Note missing information and any upcoming deadline that needs prompt confirmation.`})),
  thirtyDay:unique.map(p=>({id:p.id,title:p[locale],text:locale==='es'?`Revisa los documentos y tus respuestas con el profesional correspondiente. Confirma qué está actualizado, qué falta, la persona responsable y la próxima fecha de revisión.`:`Review the records and your answers with the appropriate professional. Confirm what is current, what needs attention, who is responsible and the next review date.`})),
  ninetyDay:unique.map(p=>({id:p.id,title:p[locale],text:locale==='es'?'Revisa el avance de los pasos acordados. Registra lo completado, lo pendiente, la persona responsable y la próxima fecha de revisión.':'Review progress on the agreed steps. Record completed items, outstanding decisions, who is responsible and the next review date.'})),
 }
}
