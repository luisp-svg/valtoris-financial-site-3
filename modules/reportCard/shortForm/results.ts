import { SHORT_FORM_VERSION, type Copy, type Locale, type ShortQuestion } from './catalog.js'
import { numericAnswer, visibleQuestions, type ShortDiagnostic } from './contract.js'
import type { PublicReportCardAssessmentType } from '../publicIngestCatalog.js'
export type ShortFinding = { id: string; status: 'review' | 'reported' | 'unknown'; title: Copy; detail: Copy }
export type ShortResult = { version: 3; kind: 'short-form-review'; overallScore: null; overallGrade: null; findings: ShortFinding[]; metrics: { id: string; label: Copy; value: number; unit: 'USD' | 'USD/month' }[]; limitations: Copy }
const copy = (en: string, es: string): Copy => ({ en, es })
export function displayShortAnswer(q: ShortQuestion, value: unknown, locale: Locale): string {
  if (value === 'unknown') return locale === 'es' ? 'No sé' : 'Not sure'
  if (q.kind === 'number') { const n = numericAnswer(value); return n === null ? '—' : `${n.toLocaleString(locale === 'es' ? 'es-US' : 'en-US')}${q.unit ? ' '+q.unit[locale] : ''}` }
  if (Array.isArray(value)) return value.map(v => q.options?.find(o => o.value === v)?.label[locale] ?? '—').join(', ')
  return q.options?.find(o => o.value === value)?.label[locale] ?? (typeof value === 'string' ? value : '—')
}
/** Observations and explicit arithmetic only. No invented values or uncalibrated letter grades. */
export function buildShortResult(type: PublicReportCardAssessmentType, d: ShortDiagnostic): ShortResult {
  const findings: ShortFinding[] = [], metrics: ShortResult['metrics'] = []
  const add = (id: string,status: ShortFinding['status'],en: string,es: string,detail: string,detalle: string) => findings.push({id,status,title:copy(en,es),detail:copy(detail,detalle)})
  const is = (key: string, ...values: string[]) => typeof d[key] === 'string' && values.includes(d[key] as string)
  const includes = (key: string, value: string) => Array.isArray(d[key]) && d[key].includes(value)
  const number = (key: string) => numericAnswer(d[key])
  if (is('cash_flow','negative')) add('cash_flow','review','Review the monthly shortfall','Revisa el déficit mensual','You reported spending more than comes in. Review income and recurring expenses before setting new commitments.','Indicaste que gastas más de lo que ingresa. Revisa ingresos y gastos recurrentes antes de asumir nuevos compromisos.')
  else if (is('cash_flow','break_even')) add('cash_flow','reported','Cash flow is currently break-even','El flujo actual está equilibrado','You reported little or no money remaining after regular bills. Identify room for reserves or goals.','Indicaste que queda poco o nada después de pagar los gastos. Busca espacio para reservas o metas.')
  else if (is('cash_flow','positive')) add('cash_flow','reported','You report a monthly surplus','Reportas un sobrante mensual','You report saving money after regular expenses. Confirm that this pattern is consistent in your intake review.','Indicaste que ahorras después de los gastos. Confirma que este patrón es constante durante la revisión de ingreso.')
  if (number('reserves') === 0) add('reserves','review','No expense reserves reported','No reportaste reservas para gastos','You entered zero months of reserves. Discuss an achievable reserve target during intake.','Indicaste cero meses de reservas. Considera una meta alcanzable durante la revisión.')
  if (type === 'family' && is('disability','no')) add('disability','review','Income replacement coverage needs review','Revisa la cobertura de reemplazo de ingresos','You reported no coverage if you cannot work. Confirm any employer benefits before deciding what is missing.','Indicaste no tener cobertura si no puedes trabajar. Confirma los beneficios de tu empleador antes de decidir qué falta.')
  if (type === 'business') {
    if (is('separation','no')) add('separation','review','Separate business records','Separa los registros del negocio','You reported mixing personal and business finances. Review dedicated accounts and bookkeeping with your professional team.','Indicaste que mezclas las finanzas personales y del negocio. Revisa cuentas dedicadas y registros con tus profesionales.')
    if (is('continuity','no')) add('continuity','review','Plan for an owner absence','Planifica una ausencia del dueño','You reported that the business could not continue for 90 days without its main owner. Document responsibilities and continuity arrangements.','Indicaste que el negocio no podría continuar 90 días sin su dueño principal. Documenta responsabilidades y planes de continuidad.')
    if (is('tax_review','never','older')) add('tax_review','review','Schedule a tax-plan review','Programa una revisión fiscal','Your reported review date suggests a follow-up conversation with your tax professional. This is not a finding of tax noncompliance.','La fecha indicada sugiere una conversación con tu profesional de impuestos. Esto no determina incumplimiento fiscal.')
  }
  if (type === 'student_loan') {
    if (is('status','delinquent','default') || is('payments','late','missed')) add('payments','review','Confirm current loan status','Confirma el estado del préstamo','You reported late or missed payments, or an adverse loan status. Obtain current servicer records before comparing next steps.','Indicaste pagos atrasados, no realizados o un estado desfavorable. Obtén registros actuales del administrador antes de comparar opciones.')
    add('loan_options','reported','Verify available repayment options','Verifica las opciones de pago','A servicer review is needed to confirm current programs and eligibility. Employer type alone does not establish eligibility or forgiveness.','Una revisión con el administrador debe confirmar programas actuales y elegibilidad. El tipo de empleador no determina elegibilidad ni condonación.')
  }
  if (type === 'credit' || type === 'home_buyer') {
    if (is('errors','yes') || includes('credit_issues','errors') || includes('negative_items','errors')) add('errors','review','Review the reported credit concern','Revisa el problema de crédito indicado','Check the actual reports and supporting records. This screen cannot verify an error or promise its removal.','Revisa los reportes y documentos. Esta evaluación no verifica errores ni promete eliminarlos.')
    if (is('overdue','yes') || is('minimums','unmanageable') || is('delay','30_59','60_plus')) add('overdue','review','Review payment obligations','Revisa las obligaciones de pago','You reported payment difficulty or delays. Verify amounts and dates with the account provider.','Indicaste dificultades o atrasos de pago. Verifica cantidades y fechas con el proveedor.')
    if (type === 'home_buyer') add('lender_review','reported','Confirm readiness with a lender','Confirma tu preparación con un prestamista','This short review does not estimate a purchase price, approve a loan, or select a loan product. A lender needs verified income, debts, funds, and financing terms.','Esta revisión no estima el precio de compra, aprueba préstamos ni selecciona productos. Un prestamista necesita verificar ingresos, deudas, fondos y términos.')
  }
  if (type === 'retirement') {
    const spending = number('spending'), income = number('income')
    if (spending !== null && income !== null) {
      metrics.push({id:'monthly_amount_to_cover',label:copy('Monthly spending not covered by stated dependable income','Gasto mensual no cubierto por los ingresos confiables indicados'),value:Math.max(0,spending-income),unit:'USD/month'})
      add('retirement_income','reported','Compare income and spending','Compara ingresos y gastos','The amount shown is simple subtraction in today’s dollars. It excludes investment withdrawals, taxes, inflation, and future changes; it is not a retirement sufficiency projection.','La cantidad es una resta simple en dólares de hoy. Excluye retiros de inversiones, impuestos, inflación y cambios futuros; no es una proyección de suficiencia para jubilarte.')
    }
    if (is('healthcare','none','partial')) add('healthcare','review','Develop the healthcare funding plan','Desarrolla el plan de gastos médicos','You reported an incomplete healthcare plan. Confirm expected coverage and costs during intake.','Indicaste un plan médico incompleto. Confirma cobertura y costos esperados durante la revisión.')
  }
  if (type === 'protection') {
    const income=number('income'), years=number('years'), debt=number('debt'), education=d.children==='0'?0:number('education'), expenses=number('final_expenses'),coverage=number('coverage')
    if ([income,years,debt,education,expenses,coverage].every(v=>v!==null)) {
      const total=income!*years!+debt!+education!+expenses!
      metrics.push({id:'simple_protection_need',label:copy('Simple selected protection need','Necesidad simple de protección seleccionada'),value:total,unit:'USD'},{id:'simple_protection_gap',label:copy('Selected need less reported life coverage','Necesidad seleccionada menos cobertura de vida indicada'),value:Math.max(0,total-coverage!),unit:'USD'})
      add('protection_math','reported','Review the protection assumptions','Revisa los supuestos de protección','Annual income × selected years + other debt + education + final expenses − life coverage. Housing is already included in income and is not added again. This simple estimate excludes assets, taxes, growth and inflation and is not a coverage recommendation.','Ingresos anuales × años seleccionados + otras deudas + educación + gastos finales − cobertura de vida. La vivienda ya está incluida en los ingresos y no se suma otra vez. La estimación excluye activos, impuestos, crecimiento e inflación; no es una recomendación de cobertura.')
    } else add('protection_unknown','unknown','Protection estimate needs more information','Falta información para estimar protección','At least one amount needed for the estimate is unknown. No missing amount was replaced with zero.','Al menos una cantidad necesaria es desconocida. Ningún dato faltante se reemplazó por cero.')
  }
  if (includes('documents','none') || includes('protections','none')) add('documents','review','Review documents or protections','Revisa documentos o protecciones','You reported that none of the listed items are current or reviewed. Confirm the relevant items with your advisor and qualified professionals.','Indicaste que ninguno de los elementos está actualizado o revisado. Confirma lo relevante con tu asesor y profesionales calificados.')
  const unknown = visibleQuestions(type,d).filter(q=>d[q.id]==='unknown'||(Array.isArray(d[q.id]) && d[q.id].includes('unknown')))
  if (unknown.length) add('unknowns','unknown','Confirm unknown information','Confirma la información desconocida',`${unknown.length} answer(s) were marked not sure. These are information gaps, not established financial problems.`,`${unknown.length} respuesta(s) se marcaron como desconocidas. Son datos por confirmar, no problemas financieros comprobados.`)
  if (!findings.length) add('review','reported','Review your stated priorities','Revisa tus prioridades indicadas','Bring the answers below to your advisor review. This short form does not establish that every planning area is complete.','Lleva estas respuestas a la revisión con tu asesor. Esta evaluación breve no determina que toda la planificación esté completa.')
  return {version:SHORT_FORM_VERSION,kind:'short-form-review',overallScore:null,overallGrade:null,findings,metrics,limitations:copy('Short-form educational review based on self-reported answers. No letter grade or calibrated readiness score is assigned. Historical full-report grades are separate. Detailed planning belongs in the private intake.','Revisión educativa breve basada en tus respuestas. No asigna calificación ni puntaje calibrado. Las calificaciones de reportes completos anteriores se mantienen separadas. La planificación detallada corresponde al formulario privado.')}
}
export function shortAnswerRows(type: PublicReportCardAssessmentType,d: ShortDiagnostic,locale: Locale) {
  return visibleQuestions(type,d).map(q=>({id:q.id,label:q.label[locale],value:displayShortAnswer(q,d[q.id],locale)}))
}

/** Read the saved version, never rescore historical CRM results. */
export function readShortResult(value: unknown): ShortResult | undefined {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const bilingual = (v: unknown): boolean => record(v) && typeof v.en === 'string' && typeof v.es === 'string'
  if (!record(value) || value.version !== 3 || value.kind !== 'short-form-review' || value.overallScore !== null || value.overallGrade !== null || !bilingual(value.limitations)) return undefined
  if (!Array.isArray(value.findings) || !value.findings.every(f => record(f) && typeof f.id === 'string' && ['review','reported','unknown'].includes(String(f.status)) && bilingual(f.title) && bilingual(f.detail))) return undefined
  if (!Array.isArray(value.metrics) || !value.metrics.every(m => record(m) && typeof m.id === 'string' && bilingual(m.label) && typeof m.value === 'number' && Number.isFinite(m.value) && m.value >= 0 && ['USD','USD/month'].includes(String(m.unit)))) return undefined
  return value as ShortResult
}
