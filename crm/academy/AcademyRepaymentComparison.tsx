const references = [
  { title: 'Federal Student Aid — Current plan eligibility and SAVE transition', url: 'https://studentaid.gov/articles/save/' },
  { title: 'Federal Student Aid — Income-driven repayment questions', url: 'https://studentaid.gov/articles/faqs-idr-plan/' },
  { title: 'Federal Student Aid — Comparing repayment estimates', url: 'https://studentaid.gov/articles/repayment-calculator/' },
]

export default function AcademyRepaymentComparison() {
  return <section className="tac-academy-material" aria-labelledby="repayment-comparison-title">
    <h3 id="repayment-comparison-title">Repayment plans and comparing options</h3>
    <p>Estimated time 25–30 minutes</p>
    <p>Learn to screen plan eligibility, compare payment and cost estimates, and document a client decision with a follow-up in TAC.</p>

    <h4>Start with the loan record</h4>
    <p>Check each loan’s program, disbursement date, consolidation history, and status. Separate private debt and parent borrowing. Collect income, filing status, household details, and the client’s budget. Confirm the existing plan and any notice deadline.</p>

    <h4>Recognize the plan families</h4>
    <div className="tac-academy-progress-scroll" role="region" aria-label="Repayment plan families" tabIndex={0}>
      <table className="crm-opportunities-table">
        <caption>Federal plan overview checked November 11, 2026</caption>
        <thead><tr><th scope="col">Plan family</th><th scope="col">What to examine</th></tr></thead>
        <tbody>
          <tr><th scope="row">Standard, Graduated, Extended</th><td>Balance-based schedules for eligible older loans. Graduated payments increase over time. Check the term and eligibility for each option.</td></tr>
          <tr><th scope="row">Tiered Standard</th><td>The fixed-payment option for loans disbursed on or after July 1, 2026. Verify the applicable term.</td></tr>
          <tr><th scope="row">Income-Based Repayment (IBR)</th><td>An income-driven option for eligible older loans. Verify borrowing history and the applicable calculation.</td></tr>
          <tr><th scope="row">Repayment Assistance Plan (RAP)</th><td>An income-driven option for eligible Direct Loans. Parent PLUS debt, including consolidation loans that repaid it, is excluded.</td></tr>
          <tr><th scope="row">PAYE and ICR</th><td>Transitional options for qualifying older loans, ending no later than July 1, 2028. Check access and the exit plan.</td></tr>
        </tbody>
      </table>
    </div>
    <p>SAVE has ended. Use the borrower’s servicer notice to establish their transition deadline. Mixed loan histories need a loan-by-loan eligibility review.</p>

    <h4>Compare the same assumptions</h4>
    <p>Use the Federal Student Aid Repayment Calculator with consistent loan and household inputs. Compare the monthly payment, repayment period, total paid, and projected discharge. Save the dated estimate and its assumptions. Calculator results are estimates, with final terms set by the servicer after processing.</p>
    <p>For an income-driven option, repeat the comparison with a plausible income change. Multiplying the first payment by every remaining month does not model changing income or establish lifetime cost. Keep any public-service or discharge analysis conditional on verification.</p>

    <h4>Worked client example</h4>
    <p>Fictional client Avery has $42,000 of Direct Unsubsidized debt, all disbursed before July 1, 2026, with no parent PLUS or private loans. Avery reports $48,000 adjusted gross income and room for $350 a month after essential expenses and a reserve. A possible raise next year would change the budget. The advisor must verify the records and current eligibility.</p>
    <div className="tac-academy-progress-scroll" role="region" aria-label="Avery repayment comparison" tabIndex={0}>
      <table className="crm-opportunities-table">
        <caption>Invented training estimates for comparison practice</caption>
        <thead><tr><th scope="col">Option</th><th scope="col">Starting monthly payment</th><th scope="col">Room within $350 budget</th><th scope="col">Further review</th></tr></thead>
        <tbody>
          <tr><th scope="row">Standard schedule</th><td>$470</td><td>$120 shortfall</td><td>Compare its full payoff schedule with the alternatives.</td></tr>
          <tr><th scope="row">Longer balance-based schedule</th><td>$310</td><td>$40 remaining</td><td>Verify eligibility, term, and total interest.</td></tr>
          <tr><th scope="row">Income-driven estimate</th><td>$190</td><td>$160 remaining</td><td>Verify the named plan and inputs. A higher-income run estimates $360, a $10 shortfall.</td></tr>
        </tbody>
      </table>
    </div>
    <p><strong>What to say</strong> “The $470 option exceeds the budget you described. The $310 and $190 starting estimates fit today, but we still need their full costs and eligibility. The higher-income estimate also exceeds today’s budget. Let’s compare that with your expected take-home pay and expenses after the raise.”</p>
    <p><strong>What to record</strong> Training estimates, pending verification. Confirm Avery’s income, borrowing dates, and household inputs. Assign Morgan to obtain the named-plan comparisons, total-paid estimates, and higher-income budget by noon Thursday. I own the 3 p.m. client update. Record Avery’s priorities and the reason for the eventual selection after the review.</p>

    <h4>TAC practice exercise</h4>
    <p>Fictional client Drew reports $55,000 of federal debt and a $400 monthly budget after essentials and a reserve. Training estimates are $520 on the current schedule, $340 on a longer balance-based schedule, and $230 initially on an income-driven option. A higher-income run estimates $420. One loan’s disbursement date is missing, and Drew mentions possible public-service work.</p>
    <p>In a development practice household, create a comparison note with one row per option. Add a review task and a client-update task with named owners and deadlines. Draft the sentence you would use to explain why the starting payment alone cannot establish the best fit.</p>
    <h4>Check your comparison</h4>
    <ul>
      <li>The current schedule exceeds the budget by $120. The longer schedule leaves $60 and the initial income-driven estimate leaves $170.</li>
      <li>The higher-income estimate exceeds today’s budget by $20. Obtain the corresponding future budget before judging affordability.</li>
      <li>Identify each actual plan and verify the missing loan date, loan type, and eligibility. Request consistent total-paid and term estimates.</li>
      <li>Keep the public-service question open until employment and loan requirements are verified. Record an owner and due date for that review.</li>
      <li>Save the assumptions, unresolved questions, and promised client update. Document the decision and follow-up after verification.</li>
    </ul>
    <h4>Repayment comparison references</h4>
    <p>Sources checked November 11, 2026</p>
    <ul>{references.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
  </section>
}
