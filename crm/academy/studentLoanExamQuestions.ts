export const STUDENT_LOAN_EXAM_CASE = {
  paragraphs: [
    'Fictional married clients Jordan and Riley want a sustainable repayment plan before Jordan changes jobs in six weeks. They set a $350 monthly loan budget while protecting reserve savings and retirement contributions. You promised an update by 3 p.m. Thursday. Morgan owns the records review due at noon Thursday.',
    'The dated records list two federal Direct Loans in Jordan’s name, disbursed in 2024, with $10,000 principal at 4% and $20,000 principal at 6%. A $10,000 detail page repeats the first loan. Riley has a separate $8,000 private loan with Jordan as cosigner. The $20,000 federal loan also has $40 unpaid interest. For its calculation, use exactly 30 days, a 365.25 divisor, constant principal and rate, a $200 payment at the end, and no fees, capitalization, subsidies, or other adjustments.',
    'A private lender advertises refinancing all three loans. The written quote is missing. The couple also asks about federal consolidation. Invented federal repayment estimates show $470 on the current fixed schedule, $310 on a longer balance-based schedule, and $300 initially under an income-driven scenario. A higher-income run estimates $360. The longer schedule’s eligibility and total cost remain unverified.',
    'Jordan’s dated PSLF tracker shows 108 confirmed qualifying payments on each federal loan, plus six later eligible months awaiting employment certification on each. Those months are outside the confirmed counts. Jordan works at a hospital, but the pending employment period was through a staffing company. Its eligibility and certified hours remain unresolved.',
    'For a separate filing-status comparison, the same income-driven plan is estimated at $420 monthly jointly and $300 separately. The tax professional’s invented full-year projection shows separate filing adds $1,800 in combined taxes, including all deduction and credit effects. Assume 12 months at each payment. The clients also ask about the tax treatment of possible future forgiveness. At noon Thursday, the written refinance quote and employment certification are still pending.',
  ],
  exercise: [
    'In a fictional development practice household, document the goal, $350 loan budget, protected savings priorities, and Thursday update. Build one inventory row per loan, identifying borrower, cosigner, dated source, principal, and unpaid interest.',
    'Show the 30-day interest calculation and $200 payment allocation for the $20,000 loan. Calculate the illustrative weighted federal consolidation rate, keeping the private loan outside it.',
    'Compare the repayment estimates with the budget and higher-income scenario. Identify the actual plans and request eligibility, total-paid, and term evidence. Flag the protections affected by privately refinancing federal loans.',
    'Record the confirmed and pending PSLF counts separately for each federal loan. Assign verification of the legal employer, dates, hours, signatures, and applicable payment rules.',
    'Calculate the annual loan-payment saving and combined tax difference for the filing-status comparison. Request a tax review of the program, effective date, and state treatment for any future discharge.',
    'Assign Morgan’s unresolved review a revised deadline, keep the Thursday client update, and draft the next check-in. Log the eventual decision and the evidence supporting it.',
  ],
  debrief: [
    {
      lesson: 'Prepare for the first conversation',
      title: 'Sample intake and inventory',
      text: 'Goal is sustainable repayment through a job change while protecting reserves and retirement savings. Jordan’s federal principal totals $30,000. The $10,000 detail repeats an included loan. Riley’s $8,000 private loan appears once, with Jordan recorded as cosigner. Track the $40 unpaid federal interest separately. Request relevant records through the approved intake channel.',
    },
    {
      lesson: 'Verify the loan record',
      title: 'Sample calculation note',
      text: 'For the $20,000 loan, $20,000 × 0.06 ÷ 365.25 × 30 = $98.56 new interest, rounded at the final step. Add $40 for $138.56 unpaid interest. The $200 payment reduces principal by $61.44, leaving $19,938.56 principal and zero unpaid interest. Federal consolidation’s illustrative weighted rate is ($10,000 × 0.04 + $20,000 × 0.06) ÷ $30,000 = 5.333333%, rounded up to 5.375%. Verify actual payoff inputs and adjustments.',
    },
    {
      lesson: 'Document the next step',
      title: 'Sample comparison and handoff',
      text: 'The $470 payment exceeds the $350 budget by $120. The $310 and $300 estimates leave $40 and $50 before the separate-filing tax effect. The $360 higher-income run exceeds today’s budget by $10. Verify actual plan names, eligibility, total cost, and the future budget. Private refinancing of federal debt loses federal protections. Each PSLF count stays at 108 confirmed, with 12 needed. Six accepted pending months would produce 114, with six needed on each loan. Separate filing saves $1,440 annually in loan payments but adds $1,800 tax, a $360 disadvantage. Keep the missing quote and certification open, assign Morgan a revised deadline, and give the promised update.',
    },
  ],
  clientUpdate: '“We have the loan inventory and preliminary comparisons. We’re still checking the written refinance terms, repayment eligibility, and the pending employment periods. The lower separate-filing payment also carries an additional tax cost in the projection. I’ll update you by noon Friday after the next review, even if some records are still pending.”',
}

export const STUDENT_LOAN_EXAM_QUESTIONS = [
  {
    prompt: 'Loan identification — Which TAC inventory correctly records the case?',
    choices: ['Two federal loans with $30,000 total principal in Jordan’s name, $40 unpaid interest recorded separately, and one $8,000 private loan in Riley’s name with Jordan as cosigner.', 'Three federal loans with $40,000 principal because the $10,000 detail is an additional account, plus the private loan.', 'Two federal loans and two $8,000 private loans, one for Riley and another for Jordan as cosigner.'],
  },
  {
    prompt: 'Interest and principal — What happens to the $20,000 loan after 30 days and the $200 payment under the stated assumptions?',
    choices: ['$98.56 new interest, $138.56 total unpaid interest before payment, and $19,938.56 principal after payment.', '$98.56 new interest and $19,898.56 principal after payment because the opening unpaid interest is excluded from allocation.', '$120 new interest because 6% is a monthly rate, leaving $19,960 principal after payment.'],
  },
  {
    prompt: 'Consolidation and refinancing — Which comparison is accurate?',
    choices: ['The federal weighted rate is the simple average, 5%, and private refinancing preserves federal protections.', 'Include Riley’s private loan in the federal consolidation calculation and assume the missing quote has equivalent protections.', 'The illustrative federal weighted rate rounds up to 5.375%. Keep the private loan outside that calculation and review the loss of federal protections before privately refinancing federal debt.'],
  },
  {
    prompt: 'Repayment plans — What should the advisor conclude from the estimates?',
    choices: ['The $470 payment exceeds budget by $120. The $310 and $300 starting estimates fit before additional tax effects, but require eligibility and full-cost verification. Recheck the future budget against the $360 income-change estimate.', 'Select the $300 estimate because its starting payment guarantees the lowest lifetime cost.', 'Treat every plan shown as eligible and multiply the first income-driven payment by all future months to establish lifetime cost.'],
  },
  {
    prompt: 'Forgiveness and PSLF — What should TAC show for Jordan’s federal loans?',
    choices: ['Combine 108 payments on each loan into a 216-payment household total and request immediate discharge.', 'Record 108 confirmed on each loan, with six pending months separately. Verify employment and applicable requirements. If all six qualify, each reaches 114, leaving six still needed.', 'Add the pending months immediately because the hospital worksite establishes employer eligibility.'],
  },
  {
    prompt: 'Tax and financial planning — What is the correct interpretation of the filing-status comparison?',
    choices: ['Separate filing improves the annual household position by $1,440 because only the loan payment changes.', 'Separate filing reduces total annual household cost by $3,240 by adding the payment saving to the additional tax.', 'Separate filing saves $1,440 in annual loan payments but adds $1,800 combined tax, a $360 disadvantage. Separate filing disallows the student loan interest deduction, whose effect is already in the supplied tax estimate. Verify the tax year, plan inputs, and timing with the tax professional while reviewing savings goals.'],
  },
  {
    prompt: 'Taxable discharge and follow-up — What belongs in the Thursday handoff?',
    choices: ['Mark all potential forgiveness tax-free and close the review because the initial calculations are complete.', 'Assume the pending quote and certification will be approved, then delay the client update until a final recommendation is ready.', 'Keep the quote and employment review open with owners and revised deadlines, give the promised update, and assign a program-, date-, and state-specific discharge tax review. Distinguish PSLF’s federal exclusion from potentially taxable income-driven forgiveness.'],
  },
] as const
