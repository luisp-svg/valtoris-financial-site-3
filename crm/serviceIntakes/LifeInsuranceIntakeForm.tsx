import ServiceIntakeForm, { type IntakeFormProps } from './ServiceIntakeForm'
import { LIFE_INTAKE_SECTIONS, calculateLifeNeeds } from './lifeInsuranceSchema'
const dollars = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export default function LifeInsuranceIntakeForm(props: IntakeFormProps) {
  const estimate = calculateLifeNeeds(props.answers)
  return <>
    <ServiceIntakeForm {...props} title="Life insurance planning intake" sections={LIFE_INTAKE_SECTIONS} notice="Private planning intake for an existing contact or completed report card. Enter medical and legal history, medications, SSNs, license details, and banking information only through the selected carrier’s secure application. Do not paste those details into these fields." />
    <section className="crm-panel" aria-labelledby="life-needs-estimate"><h2 id="life-needs-estimate">Needs worksheet result</h2>
      <p>Debt excluding mortgage + annual income × {props.answers.sections.needs[0].years || 'chosen'} years + mortgage + education + other needs, less selected existing coverage and available assets.</p>
      {estimate ? <dl className="crm-contacts-dl">
        <div><dt>Gross planning estimate</dt><dd>{dollars(estimate.grossCents)}</dd></div>
        <div><dt>Existing coverage offset</dt><dd>{dollars(estimate.coverageCents)}</dd></div>
        <div><dt>Available assets offset</dt><dd>{dollars(estimate.assetsCents)}</dd></div>
        <div><dt>Estimated remaining gap</dt><dd>{dollars(estimate.gapCents)}</dd></div>
        <div><dt>Client-requested coverage</dt><dd>{estimate.requestedCents === null ? 'Not provided' : dollars(estimate.requestedCents)}</dd></div>
        {estimate.differenceCents !== null && <div><dt>{estimate.differenceCents >= 0 ? 'Gap above requested coverage' : 'Requested coverage above gap'}</dt><dd>{dollars(Math.abs(estimate.differenceCents))}</dd></div>}
      </dl> : <p>Enter all worksheet amounts and replacement years to calculate a gap. Leave unknown amounts blank; enter zero only when confirmed.</p>}
      <p className="crm-muted">The source template starts at ten years of income. This editable calculation is planning context, not a recommendation, quote, underwriting decision, or guarantee of coverage.</p>
    </section>
  </>
}
