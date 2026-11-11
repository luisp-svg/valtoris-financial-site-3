const references = [
  { title: 'IRS — Student loan interest deduction', url: 'https://www.irs.gov/taxtopics/tc456' },
  { title: 'IRS Taxpayer Advocate Service — Forgiveness and taxes', url: 'https://www.taxpayeradvocate.irs.gov/news/tax-tips/what-to-know-about-student-loan-forgiveness-and-your-taxes/2026/03/' },
  { title: 'Federal Student Aid — Marriage and loan payments', url: 'https://studentaid.gov/articles/marriage-student-loans/' },
]

export default function AcademyTaxPlanning() {
  return <section className="tac-academy-material" aria-labelledby="tax-planning-title">
    <h3 id="tax-planning-title">Tax considerations and financial planning</h3>
    <p>Estimated time 25–30 minutes</p>
    <p>Learn to combine a loan comparison with tax estimates, cash reserves, retirement goals, and a documented review by the appropriate specialists.</p>

    <h4>Separate the tax questions</h4>
    <p>The student loan interest deduction may allow up to the lesser of $2,500 or qualified interest paid. Eligibility includes income limits, legal liability, and dependency rules. Married filing separately is excluded. Use the relevant tax year’s instructions and verify paid interest with Form 1098-E and account records.</p>
    <p>A deduction reduces taxable income. For an illustrative $1,800 fully allowable deduction at a constant 22% marginal federal rate, the estimated tax reduction is $396. This assumes no phaseout or other interactions. Confirm the actual result in the tax projection.</p>
    <p>Forgiveness requires a separate tax review. Under current IRS guidance, income-driven forgiveness in 2026 or later is generally federally taxable, subject to applicable exclusions. Qualifying PSLF is federally excluded. Review the program, effective date, any eligibility notice, and state treatment with the tax professional. Preserve the discharge notice and any Form 1099-C.</p>

    <h4>Compare filing status at the household level</h4>
    <p>Filing status can affect the income used for an income-driven loan payment. Check the specific plan, both spouses’ debt, and household inputs. Ask the tax professional for joint and separate projections covering the same tax year and the whole household.</p>
    <p>Compare annual payment savings with the additional combined tax cost, including changes to deductions and credits. Record when a filing change would actually affect the loan payment. The examples below assume 12 months at each quoted payment and include all tax effects in the supplied tax difference.</p>

    <h4>Fit the loans into the financial plan</h4>
    <p>Build a budget after essential expenses and existing tax obligations. Compare required loan payments alongside reserve savings, employer retirement benefits, other debt, insurance needs, and upcoming goals. Record what the client wants to protect and the tradeoffs they can accept.</p>
    <p>For a possible taxable discharge, obtain a dated tax projection and discuss a reserve or withholding plan. For prepayment, compare the client’s liquidity needs, other debts, and verified forgiveness path. Revisit the plan after an income change or at the agreed review date.</p>

    <h4>Worked client example</h4>
    <p>Fictional married clients Priya and Evan have $900 per month available after essentials and baseline tax obligations, before loan payments and new savings. Training loan estimates are $420 monthly when filing jointly and $300 separately. Their tax professional estimates that separate filing raises combined annual taxes by $1,800, including all deduction and credit effects.</p>
    <div className="tac-academy-progress-scroll" role="region" aria-label="Priya and Evan household comparison" tabIndex={0}>
      <table className="crm-opportunities-table">
        <caption>Invented full-year planning estimates</caption>
        <thead><tr><th scope="col">Scenario</th><th scope="col">Annual loan payments</th><th scope="col">Additional annual tax</th><th scope="col">Monthly room after loan and additional tax reserve</th></tr></thead>
        <tbody>
          <tr><th scope="row">Joint filing</th><td>$5,040</td><td>$0 baseline</td><td>$480</td></tr>
          <tr><th scope="row">Separate filing</th><td>$3,600</td><td>$1,800</td><td>$450</td></tr>
        </tbody>
      </table>
    </div>
    <p>The $120 lower loan payment saves $1,440 annually. Subtracting $1,800 additional tax gives a $360 annual disadvantage in this illustration. A $150 monthly reserve for the additional tax leaves $450. If the couple budgets $200 for reserves and $150 for retirement savings, remaining room is $130 jointly and $100 separately.</p>
    <p><strong>What to say</strong> “Separate filing lowers the estimated loan payment, but the combined tax estimate uses more than that saving. Let’s confirm the plan eligibility, payment-change timing, and tax projection before you choose. We can then compare how each option supports your reserve and retirement goals.”</p>
    <p><strong>What to record</strong> Priya and Evan’s priorities, the tax year, payment assumptions, and combined tax difference. The tax difference already includes the deduction effects. Assign the loan reviewer to confirm the named plan and effective payment date, and coordinate a tax-projection review with the client’s consent. I own the Thursday 3 p.m. update and the next budget review.</p>

    <h4>Tax and planning practice in TAC</h4>
    <p>Fictional married clients Noah and Jules have $1,000 monthly room before loan payments and new savings. Training estimates are $480 monthly jointly and $280 separately. A tax professional estimates $3,000 more combined annual tax for separate filing, including all deduction and credit effects. The clients want to save $250 monthly toward a reserve and $150 toward retirement. They also expect possible income-driven forgiveness in 2027, with no tax review yet.</p>
    <p>In a development practice household, draft a comparison note, a tax-coordination task, and a loan-verification task. Name the owners and deadlines. Draft a client update explaining the payment and tax tradeoff, then list the records needed to review the potential discharge.</p>
    <h4>Check your planning note</h4>
    <ul>
      <li>Separate filing saves $2,400 in annual loan payments. After $3,000 additional tax, the illustrated household disadvantage is $600 per year.</li>
      <li>The extra-tax reserve is $250 monthly. Joint filing leaves $520 after loan payments. Separate filing leaves $470 after loan payments and that reserve.</li>
      <li>After the proposed $400 of savings, remaining room is $120 jointly and $70 separately. These figures assume the payment difference lasts all 12 months.</li>
      <li>Verify tax year, named repayment plan, both spouses’ debt, income inputs, and payment-change timing. Obtain an updated projection if those inputs change.</li>
      <li>Request the forgiveness program, relevant notices, expected effective date, and state of residence for a tax review. Document any reserve decision and the client’s follow-up date.</li>
    </ul>
    <h4>Tax and planning references</h4>
    <p>Sources checked November 11, 2026</p>
    <ul>{references.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
  </section>
}
