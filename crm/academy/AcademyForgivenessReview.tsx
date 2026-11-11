const references = [
  { title: 'Federal Student Aid — PSLF requirements', url: 'https://studentaid.gov/manage-loans/forgiveness-cancellation/public-service' },
  { title: 'Federal Student Aid — PSLF employment and records', url: 'https://studentaid.gov/articles/4-tips-pslf-success/' },
  { title: 'Federal Student Aid — Managing forms and payment counts', url: 'https://studentaid.gov/articles/manage-your-pslf-progress/' },
  { title: 'Federal Student Aid — Income-driven repayment and discharge', url: 'https://studentaid.gov/articles/faqs-idr-plan/' },
]

export default function AcademyForgivenessReview() {
  return <section className="tac-academy-material" aria-labelledby="forgiveness-review-title">
    <h3 id="forgiveness-review-title">Loan forgiveness and PSLF</h3>
    <p>Estimated time 25–30 minutes</p>
    <p>Learn to screen a forgiveness question, reconcile progress for each loan, and create a documented TAC review with a client update.</p>

    <h4>Identify the program being reviewed</h4>
    <p>Public Service Loan Forgiveness (PSLF) concerns the remaining balance on eligible Direct Loans after 120 qualifying monthly payments and the other program requirements are met. Income-driven repayment discharge follows the applicable repayment plan’s rules and timeline. Record which path the client is asking about and verify it separately.</p>
    <p>For a projection, save the repayment assumptions, possible remaining balance, and program requirements. Refer any tax question for current review of the particular discharge and jurisdiction. An estimate of future forgiveness stays conditional on the borrower meeting the requirements.</p>

    <h4>Check employment, loans, and payments together</h4>
    <ul>
      <li>Verify the loan type, status, borrowing dates, and repayment plan against current PSLF rules. Review FFEL, Perkins, and consolidation questions before proposing a change.</li>
      <li>Check the legal employer using its EIN and PSLF Employer Search. Record certified dates and average hours. The general full-time threshold is an average of 30 hours per week.</li>
      <li>Match the period of employment with the payment history. Work location and job title alone do not establish employer eligibility. A contractor working at a hospital may have a different payroll employer.</li>
      <li>Check payment timing and amount under the rules applicable to the loan and plan. Mark each period as confirmed, awaiting documentation, or requiring review.</li>
    </ul>

    <h4>Read the payment tracker carefully</h4>
    <p>Use the borrower’s StudentAid.gov PSLF records to review forms, signatures, and payment counts for each loan. An eligible payment awaiting employment certification has a different status from a confirmed qualifying payment. Record the displayed status and the date you checked it.</p>
    <p>Submit employment documentation through the PSLF Help Tool, follow pending signatures, and review the response. Federal Student Aid recommends a form annually and when changing jobs. Preserve dated forms and correspondence through the approved document channel.</p>
    <p>If a period is disputed, collect its dates and explanation for a reconsideration review. Deferment, forbearance, consolidation, and buyback questions require their own current eligibility check. Keep those periods outside the confirmed qualifying count while the decision is pending.</p>

    <h4>Worked client example</h4>
    <p>Fictional client Maya has a nondefaulted Direct Loan and wants to know whether a hospital job means the balance is ready for forgiveness. A dated tracker shows 108 qualifying payments, six additional eligible months awaiting employment certification, and three separate months marked ineligible. The three groups do not overlap. Maya reports 36 hours per week, but her earlier employment was through a staffing company.</p>
    <div className="tac-academy-progress-scroll" role="region" aria-label="Maya PSLF count reconciliation" tabIndex={0}>
      <table className="crm-opportunities-table">
        <caption>Maya’s fictional tracker review</caption>
        <thead><tr><th scope="col">Status</th><th scope="col">Months</th><th scope="col">Treatment in TAC</th></tr></thead>
        <tbody>
          <tr><th scope="row">Confirmed qualifying</th><td>108</td><td>Record the dated tracker count. The gap to 120 is 12.</td></tr>
          <tr><th scope="row">Employment certification pending</th><td>6</td><td>Verify the payroll employer, dates, hours, and form. If all six are accepted, the count becomes 114 with six still needed.</td></tr>
          <tr><th scope="row">Marked ineligible</th><td>3</td><td>Record the stated reasons and investigate any evidence of an error.</td></tr>
        </tbody>
      </table>
    </div>
    <p><strong>What to say</strong> “The tracker currently confirms 108 qualifying payments. We need to check the six pending months against your actual employer and review the three ineligible periods. Even if all six pending months are accepted, that would bring this count to 114. I’ll update you Thursday after the records review.”</p>
    <p><strong>What to record</strong> Maya’s goal, loan and plan details, tracker date, and the three status groups. Assign Morgan to verify the staffing company’s EIN and employment periods, follow the certification status, and review the ineligible-period reasons by noon Thursday. I own the 3 p.m. update. At 120, verify all remaining requirements and the forgiveness request status before recording an approved discharge.</p>

    <h4>PSLF practice in TAC</h4>
    <p>Fictional client Lee has two Direct Loans. Their dated tracker confirms 102 qualifying payments on Loan A and 96 on Loan B. Six later months on each loan await employment certification. Those later months are outside each loan’s confirmed count. Lee changed employers during that period and believes the loans have already reached 120.</p>
    <p>In a development practice household, draft a note with one count row per loan and a separate employment timeline. Add a review task and a client-update task with named owners and due dates. Draft a client explanation of the current counts and what remains conditional.</p>
    <h4>Check your forgiveness review</h4>
    <ul>
      <li>Loan A has 18 qualifying payments still needed and Loan B has 24, based on the displayed confirmed counts.</li>
      <li>If all six pending months qualify on both loans, the counts become 108 and 102. The remaining gaps become 12 and 18.</li>
      <li>Keep loan counts separate. The same calendar month may qualify for both loans, while each loan has its own progress record.</li>
      <li>Verify each employer’s EIN, dates, hours, and form status. Record why any period remains unresolved and who will follow up.</li>
      <li>Log the client update and next check-in. Track an eventual forgiveness request and official decision separately from a projected count.</li>
    </ul>
    <h4>Forgiveness review references</h4>
    <p>Sources checked November 11, 2026. Recheck current program rules and borrower-specific records before a recommendation.</p>
    <ul>{references.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
  </section>
}
