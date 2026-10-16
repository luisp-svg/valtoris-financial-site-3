import type { HomePaymentRange } from '../../../modules/reportCard/shortForm/homePaymentRange'
import type { Locale } from '../../../modules/reportCard/shortForm/catalog'

export default function HomePaymentRangePanel({ result, locale }: { result: HomePaymentRange; locale: Locale }) {
  const es = locale === 'es'
  const t = (en: string, spanish: string) => es ? spanish : en
  const currency = (n: number) => new Intl.NumberFormat(es ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  const percent = (n: number) => new Intl.NumberFormat(es ? 'es-US' : 'en-US', { style: 'percent', maximumFractionDigits: 0 }).format(n)
  const unknown = t('Not provided', 'No proporcionado')
  const money = (n: number | null) => n === null ? unknown : currency(n)
  const a = result.assumptions
  const statuses = {
    insufficient_data: t('Enter your gross monthly income, monthly non-housing debt payments and maximum housing budget, and select a primary home to calculate a range. Unknown amounts are not treated as zero.', 'Ingresa tu ingreso bruto mensual, pagos mensuales de deudas sin vivienda y presupuesto máximo de vivienda, y selecciona vivienda principal para calcular un rango. Los montos desconocidos no se consideran cero.'),
    no_capacity: t('These planning scenarios leave no positive monthly housing budget with the amounts reported. Review your income, debts and budget with an advisor. This is not a lending decision.', 'Estos escenarios no dejan un presupuesto mensual positivo para vivienda con los montos indicados. Revisa ingresos, deudas y presupuesto con un asesor. Esto no es una decisión de préstamo.'),
    unsupported: t('This estimate is for a primary home. A second home or investment property needs a separate lender review.', 'Esta estimación es para una vivienda principal. Una segunda vivienda o propiedad de inversión requiere una revisión separada con un prestamista.'),
    available: '',
  }
  return <section className="home-payment-range" aria-label={t('Estimated monthly home-payment range', 'Rango estimado del pago mensual de vivienda')}>
    <p className="short-kicker">{t('YOUR HOME-PAYMENT ESTIMATE', 'TU ESTIMACIÓN DEL PAGO DE VIVIENDA')}</p>
    <h2>{t('Estimated monthly home-payment range', 'Rango estimado del pago mensual de vivienda')}</h2>
    <p>{t('Planning estimate • Not a preapproval', 'Estimación de planificación • No es preaprobación')}</p>
    {result.status === 'available' ? <>
      <p className="home-payment-range-value">{currency(result.lowerMonthlyPayment!)} – {currency(result.upperMonthlyPayment!)} <span>{t('/ month', '/ mes')}</span></p>
      <p>{t('Based on your reported income, monthly debt payments and maximum housing budget.', 'Basado en tus ingresos, pagos mensuales de deudas y presupuesto máximo de vivienda declarados.')}</p>
      {result.lowerMonthlyPayment === 0 ? <p>{t('The conservative scenario leaves no housing budget; only the higher scenario produces a positive amount.', 'El escenario conservador no deja presupuesto para vivienda; solo el escenario superior produce un monto positivo.')}</p> : null}
    </> : <p role="status">{statuses[result.status]}</p>}
    <p>{t('Use this as a total housing-payment budget: principal, interest, property taxes, homeowners insurance, mortgage insurance and HOA fees, when applicable. It is not a quote for a specific property. Set aside a separate budget for utilities, maintenance and other living expenses.', 'Úsalo como presupuesto del pago total de vivienda: capital, intereses, impuestos de la propiedad, seguro de vivienda, seguro hipotecario y cuotas HOA, cuando correspondan. No es una cotización para una propiedad específica. Separa otro presupuesto para servicios, mantenimiento y demás gastos de vida.')}</p>
    <details>
      <summary>{t('See the inputs and planning assumptions', 'Ver los datos y supuestos de planificación')}</summary>
      <dl>
        <dt>{t('Gross monthly income, all applicants', 'Ingreso bruto mensual de todos los solicitantes')}</dt><dd>{money(result.grossMonthlyIncome)}</dd>
        <dt>{t('Monthly non-housing debt payments', 'Pagos mensuales de deudas sin vivienda')}</dt><dd>{money(result.monthlyDebt)}</dd>
        <dt>{t('Your maximum monthly housing budget', 'Tu presupuesto mensual máximo de vivienda')}</dt><dd>{money(result.maximumHousingPayment)}</dd>
      </dl>
      <p>{t(`Conservative scenario: the lowest of ${percent(a.conservativeHousingRatio)} of gross income, ${percent(a.conservativeTotalDebtRatio)} of gross income minus monthly debts, and your maximum housing budget.`, `Escenario conservador: el menor de ${percent(a.conservativeHousingRatio)} del ingreso bruto, ${percent(a.conservativeTotalDebtRatio)} del ingreso bruto menos deudas mensuales, y tu presupuesto máximo de vivienda.`)}</p>
      <p>{t(`Upper scenario: the lowest of ${percent(a.upperHousingRatio)} of gross income, ${percent(a.upperTotalDebtRatio)} of gross income minus monthly debts, and your maximum housing budget.`, `Escenario superior: el menor de ${percent(a.upperHousingRatio)} del ingreso bruto, ${percent(a.upperTotalDebtRatio)} del ingreso bruto menos deudas mensuales, y tu presupuesto máximo de vivienda.`)}</p>
      <p>{t('Both scenarios have a floor of $0 and are rounded down to whole dollars. These percentages are illustrative planning assumptions, not universal lender limits. The lower number is a conservative scenario, not a minimum required payment. No interest rate or loan term is assumed because this estimates a payment budget, not a loan amount or home price.', 'Ambos escenarios tienen un mínimo de $0 y se redondean hacia abajo a dólares enteros. Estos porcentajes son supuestos ilustrativos de planificación, no límites universales de prestamistas. El monto inferior es un escenario conservador, no un pago mínimo requerido. No se supone tasa de interés ni plazo porque se estima un presupuesto de pago, no un monto de préstamo ni precio de vivienda.')}</p>
      <p>{t('Purchase funds, down payment, closing costs, reserves, credit history and employment history are not used to establish qualification here. Other housing payments that continue after purchase and unreported debts can reduce the range. Self-employed income needs lender review after business expenses. The estimate does not verify take-home pay or your complete household budget.', 'Los fondos de compra, anticipo, costos de cierre, reservas, historial crediticio y laboral no se usan para determinar calificación aquí. Otros pagos de vivienda que continúen después de la compra y deudas no declaradas pueden reducir el rango. Los ingresos de trabajo por cuenta propia requieren revisión del prestamista después de gastos del negocio. La estimación no verifica ingreso neto ni el presupuesto completo del hogar.')}</p>
      <a href="https://www.consumerfinance.gov/ask-cfpb/what-is-a-debt-to-income-ratio-en-1791/" target="_blank" rel="noreferrer">{t('About debt-to-income ratios (CFPB)', 'Acerca de la relación deuda-ingreso (CFPB)')}</a>
    </details>
    <p><strong>{t('Educational estimate only. Not a loan offer, qualification, preapproval or guarantee. A lender must verify your income, debts, credit, funds and property costs.', 'Estimación educativa solamente. No es oferta de préstamo, calificación, preaprobación ni garantía. Un prestamista debe verificar ingresos, deudas, crédito, fondos y costos de la propiedad.')}</strong></p>
  </section>
}
