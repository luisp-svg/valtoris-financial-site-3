import type { AffordabilityResult } from './affordability'

const copy = {
  en: {
    shortDisclosure: 'Educational estimate • Not a preapproval', definitions: 'How to read this estimate', title: 'Your estimated home-buying range', payment: 'Estimated monthly housing payment range', current: 'Current estimated debt-to-income ratio', projected: 'Projected debt-to-income range',
    target: 'Target home price', gap: 'Target above the estimated upper range', factors: 'What influences this estimate?', assumptions: 'Planning assumptions',
    disclosure: 'Educational estimate only — not a loan offer, qualification, preapproval, or guarantee. Income and credit are self-reported. A lender must verify income, credit, debts, property costs, and program requirements. Actual costs and eligibility may differ.',
    debtNote: 'Current DTI includes reported monthly debts and current housing only when you own. Rent is not counted as debt. Projected DTI includes the new housing payment and housing obligations that continue. Income uses W-2 gross, business net, and other recurring amounts you reported.',
    paymentNote: 'Housing includes principal, interest, estimated property tax, homeowners insurance, mortgage insurance when applicable, and HOA fees. Maintenance, utilities, moving costs, and other living expenses are not included.',
    gapNote: 'This is a home-price difference, not additional cash required. A zero gap does not establish qualification.',
    cash: 'Estimated cash to close', reserves: 'Additional reserve protection', unknown: 'Not provided / cannot calculate',
    term: 'Loan term (years)', tax: 'Annual property tax (% of price)', insurance: 'Annual homeowners insurance (% of price)', mi: 'Annual mortgage insurance (% of loan when down payment is below 20%)', down: 'Down payment', closing: 'Closing costs (% of price)', floor: 'Protected reserve floor', hoa: 'Monthly HOA',
    scenario: 'Scenario', rate: 'Illustrative interest rate', housing: 'Housing budget / income', total: 'Total debt budget / income',
    assumptionNote: 'These are configurable illustrative scenarios, not current rate quotes or lender limits. Purchase funds are used once for down payment and closing costs. Funds already protected as reserves are not subtracted again; only any shortfall to the reserve floor is set aside. Retirement balances are not automatically spent.',
    statuses: { insufficient_data: 'Complete the income, debt, available funds, protected reserves, and continuing housing amounts to estimate a range. Blank amounts remain unknown.', no_income: 'A price range cannot be estimated without positive reported recurring income.', no_capacity: 'These scenarios do not support a positive range with the reported income, obligations, and funds. Review the inputs and discuss next steps with an advisor.', unsupported: 'This calculator currently models a primary residence for you and, if applicable, a co-applicant. Other ownership arrangements require individual review.', invalid_assumptions: 'The estimate is unavailable because the planning assumptions need review.', available: '' },
    influence: { debt: 'Monthly debts and continuing housing obligations reduce the payment budget.', funds: 'Available purchase funds limit at least one scenario.', reserves: 'Part of the available funds is set aside to reach the displayed reserve floor.', stability: 'Short or uncertain industry history needs review; it does not directly change the price calculation.', income: 'The calculation uses the reported recurring income of the applicant(s), without lender verification.' },
  },
  es: {
    shortDisclosure: 'Estimación educativa • No es preaprobación', definitions: 'Cómo interpretar esta estimación', title: 'Su rango estimado de compra de vivienda', payment: 'Rango estimado del pago mensual de vivienda', current: 'Relación deuda-ingreso actual estimada', projected: 'Rango proyectado de deuda-ingreso',
    target: 'Precio objetivo', gap: 'Objetivo por encima del límite superior estimado', factors: '¿Qué influye en esta estimación?', assumptions: 'Supuestos de planificación',
    disclosure: 'Estimación educativa solamente — no es oferta de préstamo, calificación, preaprobación ni garantía. Ingresos y crédito son declarados por usted. Un prestamista debe verificar ingresos, crédito, deudas, costos de propiedad y requisitos. Costos y elegibilidad reales pueden variar.',
    debtNote: 'La relación actual incluye deudas mensuales y vivienda actual solo si es propietario. El alquiler no se cuenta como deuda. La relación proyectada incluye el nuevo pago de vivienda y obligaciones que continúan. Los ingresos usan W-2 bruto, negocio neto y otros montos recurrentes declarados.',
    paymentNote: 'La vivienda incluye capital, intereses, impuestos estimados, seguro de vivienda, seguro hipotecario cuando aplica y HOA. No incluye mantenimiento, servicios, mudanza ni otros gastos de vida.',
    gapNote: 'Esta es una diferencia de precio, no efectivo adicional requerido. Una diferencia de cero no determina calificación.',
    cash: 'Efectivo estimado para el cierre', reserves: 'Protección adicional de reservas', unknown: 'No proporcionado / no se puede calcular',
    term: 'Plazo del préstamo (años)', tax: 'Impuesto anual (% del precio)', insurance: 'Seguro anual de vivienda (% del precio)', mi: 'Seguro hipotecario anual (% del préstamo con anticipo menor del 20%)', down: 'Anticipo', closing: 'Costos de cierre (% del precio)', floor: 'Reserva mínima protegida', hoa: 'HOA mensual',
    scenario: 'Escenario', rate: 'Tasa de interés ilustrativa', housing: 'Presupuesto de vivienda / ingreso', total: 'Presupuesto de deuda total / ingreso',
    assumptionNote: 'Son escenarios ilustrativos configurables, no tasas actuales ni límites del prestamista. Los fondos se usan una vez para anticipo y cierre. Las reservas ya protegidas no se restan de nuevo; solo se separa lo necesario para alcanzar el mínimo. No se gastan automáticamente saldos de jubilación.',
    statuses: { insufficient_data: 'Complete ingresos, deudas, fondos disponibles, reservas protegidas y vivienda que continúa para estimar un rango. Los montos en blanco siguen desconocidos.', no_income: 'No se puede estimar un rango sin ingresos recurrentes declarados positivos.', no_capacity: 'Estos escenarios no permiten un rango positivo con los ingresos, obligaciones y fondos declarados. Revise los datos y consulte a un asesor.', unsupported: 'Esta calculadora modela una residencia principal para usted y, si aplica, un cosolicitante. Otros acuerdos requieren revisión individual.', invalid_assumptions: 'La estimación no está disponible porque los supuestos necesitan revisión.', available: '' },
    influence: { debt: 'Deudas mensuales y vivienda que continúa reducen el presupuesto del pago.', funds: 'Los fondos de compra limitan al menos un escenario.', reserves: 'Se separa parte de los fondos para alcanzar la reserva mínima mostrada.', stability: 'La trayectoria laboral corta o incierta requiere revisión; no cambia directamente el cálculo de precio.', income: 'El cálculo usa ingresos recurrentes declarados de los solicitantes, sin verificación del prestamista.' },
  },
}
export default function AffordabilityPanel({ result, locale = 'en' }: { result: AffordabilityResult; locale?: 'en' | 'es' }) {
  const t = copy[locale]
  const currency = (n: number) => new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  const percent = (n: number) => new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'percent', maximumFractionDigits: 2 }).format(n)
  const span = (values: number[], format = currency) => `${format(Math.min(...values))} – ${format(Math.max(...values))}`
  const a = result.assumptions
  return <section className="results-panel home-buyer-affordability" aria-label={t.title} data-testid="home-buyer-affordability">
    <h2>{t.title}</h2>
    <p><strong>{t.shortDisclosure}</strong></p>
    {result.status === 'available' ? <>
      <p className="home-buyer-affordability-range">{span(result.scenarios.map(s => s.homePrice))}</p>
      <dl>
        <dt>{t.payment}</dt><dd>{span(result.scenarios.map(s => s.monthlyPayment))}</dd>
        <dt>{t.projected}</dt><dd>{span(result.scenarios.map(s => s.projectedDti), percent)}</dd>
        <dt>{t.cash}</dt><dd>{span(result.scenarios.map(s => s.cashToClose))}</dd>
      </dl>
    </> : <p role="status">{t.statuses[result.status]}</p>}
    <dl>
      <dt>{t.current}</dt><dd>{result.currentDti === null ? t.unknown : percent(result.currentDti)}</dd>
      <dt>{t.target}</dt><dd>{result.targetPrice === null ? t.unknown : currency(result.targetPrice)}</dd>
      {result.targetGap !== null ? <><dt>{t.gap}</dt><dd>{currency(result.targetGap)}</dd></> : null}
      {result.reserveTopUp !== null ? <><dt>{t.reserves}</dt><dd>{currency(result.reserveTopUp)}</dd></> : null}
    </dl>
    {result.targetGap !== null ? <p>{t.gapNote}</p> : null}
    <details><summary>{t.definitions}</summary><p>{t.debtNote}</p><p>{t.paymentNote}</p></details>
    {result.factors.length ? <><h3>{t.factors}</h3><ul>{result.factors.map(f => <li key={f}>{t.influence[f as keyof typeof t.influence]}</li>)}</ul></> : null}
    <details><summary>{t.assumptions} · v{a.version}</summary>
      <p>{t.assumptionNote}</p>
      <dl>{([
        [t.term, String(a.termYears)], [t.tax, percent(a.annualTaxRate)], [t.insurance, percent(a.annualInsuranceRate)],
        [t.mi, percent(a.annualMortgageInsuranceRate)], [t.down, percent(a.downPaymentRate)], [t.closing, percent(a.closingCostRate)],
        [t.floor, currency(a.reserveFloor)], [t.hoa, currency(a.monthlyHoa)],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {a.scenarios.map((s, i) => <div key={i}><h4>{t.scenario} {i + 1}</h4><ul>
        <li>{t.rate}: {percent(s.annualInterestRate)}</li><li>{t.housing}: {percent(s.housingRatio)}</li><li>{t.total}: {percent(s.totalDebtRatio)}</li>
      </ul></div>)}
    </details>
    <p className="family-results-disclaimer"><strong>{t.disclosure}</strong></p>
  </section>
}
