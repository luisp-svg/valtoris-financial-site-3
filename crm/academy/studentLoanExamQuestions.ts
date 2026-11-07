export const STUDENT_LOAN_EXAM_CASE = {
  paragraphs: [
    'Jordan and Riley are reviewing their household budget before Jordan starts a new job. Jordan’s first paycheck at the new job arrives next Tuesday. The household wants to know what payments may come due before then, and you promised an update by 3 p.m. Thursday.',
    'Jordan estimates the household owes about $30,000. Jordan’s October 28 servicer summary lists two loans totaling $21,600 and a payment due Friday. A detail page from the same date lists $8,400 for one of those two loans. Riley reports a separate private loan and thinks its payment is due Monday. You have no statement for Riley’s loan.',
    'Morgan, the reviewing advisor, can check the file by noon Thursday. You own the client update. At noon Thursday, Riley’s statement is still missing.',
  ],
  exercise: [
    'In a fictional development practice household, draft an intake note that captures the client’s decision, timeline, and promised update.',
    'Record each borrower separately. Label verified and client-reported figures, cite the statement date, and flag the evidence you still need.',
    'Draft a review task for Morgan and a separate client-update task for yourself. Include due times and what would count as completing each task.',
    'Draft the Thursday update and record how you would escalate the unresolved review and set the next check-in.',
  ],
  debrief: [
    {
      lesson: 'Prepare for the first conversation',
      title: 'Sample intake note',
      text: 'Jordan and Riley need to know which payments may be due before Jordan’s first paycheck next Tuesday. I promised an update by 3 p.m. Thursday. Ask Riley to share a dated statement through the approved intake channel showing the account, payment amount, and due date.',
    },
    {
      lesson: 'Verify the loan record',
      title: 'Sample verification note',
      text: 'Jordan’s October 28 summary verifies $21,600 across two loans and lists a Friday payment. The $8,400 detail is already included. The $30,000 household balance is an estimate. Riley reports a Monday payment. Its amount and due date still need verification.',
    },
    {
      lesson: 'Document the next step',
      title: 'Sample task handoff',
      text: 'Morgan checks Riley’s statement for the payment amount and due date by noon Thursday and logs the source or the missing evidence. At noon the statement is still missing, so I alert the team lead and keep Morgan’s review task open with a revised deadline of 11 a.m. Friday. I own the 3 p.m. update and will contact the client again by noon Friday. I’ll log what I told the client and the Friday follow-up in TAC.',
    },
  ],
  clientUpdate: '“Jordan’s statement shows a Friday payment. We’re still checking the payment Riley expects on Monday. Could you send the latest statement through our intake channel? I’ll check in again by noon Friday, even if we’re still waiting for it.”',
}

export const STUDENT_LOAN_EXAM_QUESTIONS = [
  {
    prompt: 'First conversation — What decision and timeline belong at the top of the intake note?',
    choices: ['Identify payments that may come due before Jordan’s first paycheck next Tuesday, with an update due Thursday at 3 p.m.', 'Estimate how long it will take to repay the household’s loans using the new salary.', 'Wait for the first paycheck, then ask the household which payments came due.'],
  },
  {
    prompt: 'Verify the loan record — What is the verified subtotal for Jordan’s two loans?',
    choices: ['$21,600 as of October 28. The $8,400 detail is included in that subtotal.', '$30,000 as of October 28. Add the $8,400 detail to the $21,600 summary.', '$13,200 as of October 28. Subtract the $8,400 detail from the $21,600 summary.'],
  },
  {
    prompt: 'Verify the loan record — How should you record the household estimate and Riley’s payment?',
    choices: ['Verify Riley’s balance at $8,400 by subtracting Jordan’s subtotal from the estimate, and record Monday as confirmed.', 'Mark the full household balance as verified because the estimate matches the summary plus the detail page.', 'Keep $30,000 as client-reported, record Riley’s reported Monday due date separately, and leave Riley’s balance and due date unverified.'],
  },
  {
    prompt: 'First conversation — What should you request to resolve the gap in the intake?',
    choices: ['Ask Riley for a dated statement through the approved intake channel that identifies the account and shows the payment amount and due date.', 'Ask Jordan for another copy of the $8,400 detail page to verify Riley’s payment.', 'Ask Riley for a verbal balance estimate and use that to confirm the next payment.'],
  },
  {
    prompt: 'Document the next step — Which TAC task gives Morgan a clear review assignment?',
    choices: ['Ask Morgan to review all household debt and send an update when finished.', 'Assign Morgan to check Riley’s statement against the reported payment details and log the source or missing evidence by noon Thursday.', 'Assign Morgan to mark the payment review complete by 3 p.m. Thursday using the current intake.'],
  },
  {
    prompt: 'Document the next step — What do you do when Riley’s statement is still missing at noon?',
    choices: ['Move the 3 p.m. update to after the statement arrives.', 'Close the review and tell the household that both payment dates are verified.', 'Flag the stalled review to the team lead, keep the 3 p.m. update, explain what remains open, and give the client a next check-in.'],
  },
  {
    prompt: 'Document the next step — What belongs in TAC after you give the Thursday update?',
    choices: ['Only the timestamp of the update, since the review task already exists.', 'A completed review task with Monday recorded as confirmed and a reminder to check later.', 'What you told the client, the next check-in, and the open verification task with its owner and revised deadline.'],
  },
] as const
