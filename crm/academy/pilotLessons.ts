export const PILOT_LESSONS = [
  {
    id: 'first-conversation',
    title: 'Prepare for the first conversation',
    goal: 'Turn a broad request for student loan help into a clear question to investigate.',
    material: {
      duration: '15–20 minutes',
      objectives: [
        'Translate a request for help into a decision the client needs to make.',
        'Identify the records needed to understand who owes each loan and what is currently due.',
        'Record the client’s goal, open questions, and next action in TAC.',
      ],
      sections: [
        {
          title: 'Find the decision behind the request',
          paragraphs: [
            'When a client asks for a lower payment, ask what they need the change to accomplish. They may be trying to manage a temporary income gap, prepare for a job change, or make room for another household priority. Ask when they expect the change and when the next payment is due.',
            'Repeat the goal back to the client. “You want to understand what your household would need to pay during the transition, starting with the next bill.” This gives the review a clear scope and helps distinguish an urgent cash-flow question from a longer-term decision.',
          ],
        },
        {
          title: 'Build a first-pass loan inventory',
          paragraphs: [
            'Ask whose name is on each loan, whether the client believes it is federal or private, and which servicer or lender is listed on the statement. A household may include several borrowers. Keep their accounts separate and mark any answer that is based only on memory.',
            'Request recent statements through the approved intake channel. For each loan, look for the balance, interest rate, payment amount, due date, and any listed repayment plan or status. Record the source and date when the information arrives. Ask for records relevant to the decision and direct the client to share them without sending account passwords.',
          ],
        },
        {
          title: 'Hand off a question someone can answer',
          paragraphs: [
            'In TAC, note the client’s goal, the deadline, what they reported, and what still needs verification. Give each next action an owner. The client might gather the statements, while the advisor checks that the records match the accounts described and schedules the review.',
            'Tell the client what will happen after the records arrive. If a payment is due soon, agree on when you will check in and flag the deadline for the reviewing advisor. Record any unanswered question explicitly so it stays visible when the case changes hands.',
          ],
        },
      ],
      example: {
        situation: 'A fictional client is changing jobs in six weeks. They recall paying about $450 a month and think they have both federal and private loans. Their next bill is due before the transition, and they have no statements available during the call.',
        response: '“Let’s confirm what’s due and when before we review options for the job transition. Could you send the latest statement for each loan through our intake channel by Wednesday? I’ll check which accounts the statements cover and update you Thursday.”',
        record: 'Client wants to plan for loan payments during a job change in six weeks. The $450 monthly total and loan types are client-reported. Next bill is reportedly due before the transition. The client will send recent statements by Wednesday. The referring advisor owns the Thursday follow-up to confirm account coverage and the next review step.',
      },
      exercise: {
        prompt: 'A fictional client expects reduced hours next month. They report two loans, including one they describe as a parent loan, and think a payment is due next Friday. They’re unsure whose name is on the parent loan.',
        instruction: 'In a development practice household, draft an intake note, a short records request, and an assigned follow-up task. Include the sentence you would use to confirm the client’s goal.',
        checklist: [
          'Capture the decision and the reported payment deadline in plain language.',
          'Separate client-reported details from facts that still need verification, especially who owes each loan.',
          'Request dated statements through the approved intake channel and identify the fields to check.',
          'Assign an advisor to review the records and update the client before the reported deadline.',
        ],
      },
    },
    steps: [
      'Ask what the client is trying to decide and whether they have a deadline. Capture their goal in their own words.',
      'Confirm who is involved and what documents the client can provide through the approved intake process.',
      'Agree on the next action and who will take it. Record the commitment in TAC so it can be followed up.',
    ],
    scenario: 'A client says they want a lower payment but also expects a change in employment. They have not shared any loan statements.',
    question: 'What is the best first step?',
    choices: ['Recommend a plan based on their current payment.', 'Clarify their goal and timeline, then request the records needed to review their options.', 'Wait for the client to choose an option before creating a follow-up.'],
    feedback: 'A clear goal and verified records give the advisor a basis for review. A named next action keeps the work moving.',
  },
  {
    id: 'verify-the-record',
    title: 'Verify the loan record',
    goal: 'Separate documented facts from information that still needs confirmation.',
    material: {
      duration: '15–20 minutes',
      objectives: [
        'Match each statement to the borrower, account, and date it covers.',
        'Distinguish a verified account balance from an unverified household total.',
        'Document the discrepancy in TAC and assign a specific verification task.',
      ],
      sections: [
        {
          title: 'Match the records before comparing the numbers',
          paragraphs: [
            'Start with the borrower, servicer or lender, account reference, and statement date. Identify whether each figure represents one loan, several loans on a combined statement, or a total the client estimated for the household. Use a partial account reference if you need one to distinguish records.',
            'A later date tells you when a figure was reported. Check that the later statement covers the same borrower and loans before treating it as an update. If it covers only part of the intake, verify that part and leave the rest open.',
          ],
        },
        {
          title: 'Record what each source actually supports',
          paragraphs: [
            'Keep the intake estimate and the documented figure separate. For a statement, record the balance as of the date shown and identify the loans it includes. If a payment amount or due date matters to the decision, record it as a separate field with its own source.',
            'When two amounts differ, ask what would reconcile them. You may need to confirm which accounts were included or request another dated statement. Until you have that evidence, leave the explanation open. A difference between two figures does not tell you why they differ.',
          ],
        },
        {
          title: 'Turn the discrepancy into a follow-up task',
          paragraphs: [
            'In TAC, record what is verified, what is client-reported, and the question still open. Make the task specific enough that another advisor knows what evidence to request. For example, ask them to confirm whether the intake total includes a second borrower and obtain that borrower’s statement through the approved intake channel.',
            'Assign an owner and a due date that supports the client’s review deadline. Once the missing record arrives, update the verified figures with their source and date, resolve the discrepancy if you can explain it, and record what is ready for review.',
          ],
        },
      ],
      example: {
        situation: 'A fictional household reports about $31,000 in student loan balances on October 10. An October 28 statement shows $27,800 for Morgan’s loans with one servicer. Morgan thinks the intake may also include Taylor’s loan, but Taylor’s statement is missing.',
        response: '“I can verify $27,800 for the loans on your October 28 statement. To reconcile that with the intake estimate, can you confirm whether it included Taylor’s loan and send Taylor’s latest statement through our intake channel?”',
        record: 'The household reported approximately $31,000 on October 10. Morgan’s October 28 statement verifies $27,800 for the accounts listed there. Whether Taylor’s loan was included in the intake remains open. The assigned advisor will confirm the scope of the estimate and review the missing statement before the household review.',
      },
      exercise: {
        prompt: 'A fictional client reports $24,000 in loans. They send a summary dated October 20 showing $22,400 for two loans and a detail page from the same date showing $9,400 for one of those two loans. They mention another lender but provide no statement for it.',
        instruction: 'In a development practice household, draft a verification note and an assigned follow-up task. Include the verified subtotal, why the detail page should not be added again, and the question you would ask the client about the other lender.',
        checklist: [
          'Record $22,400 as the verified subtotal for the two loans shown on October 20.',
          'Identify the $9,400 detail as part of that subtotal and avoid counting it twice.',
          'Keep $24,000 as the client-reported estimate and mark the full total unverified.',
          'Assign someone to confirm the other account and request a dated statement before the review.',
        ],
      },
    },
    steps: [
      'Record the source and date for each statement or account summary. Keep household members and accounts distinct.',
      'Compare the documents with the intake. Flag differences and missing information so the next reviewer can see what remains open.',
      'Use approved document channels and capture only what is needed for the review. Practice with fictional records in Academy.',
    ],
    scenario: 'The intake lists one balance, but a newer statement lists another. The client is unsure which accounts are included.',
    question: 'How should you document this?',
    choices: ['Mark the older figure verified because it was entered first.', 'Average the two balances.', 'Record both sources and dates, flag the difference, and ask the client to confirm the accounts.'],
    feedback: 'Documenting the difference preserves the evidence and gives the next reviewer a specific question to resolve.',
  },
  {
    id: 'handoff-and-follow-up',
    title: 'Document the next step',
    goal: 'Leave a handoff that another advisor can pick up without reconstructing the conversation.',
    material: {
      duration: '15–20 minutes',
      objectives: [
        'Summarize the client’s goal, verified facts, and the open question in a TAC note.',
        'Assign the review and client update with separate owners and deadlines when needed.',
        'Escalate a stalled review and record the outcome of the client follow-up.',
      ],
      sections: [
        {
          title: 'Write for the advisor taking over',
          paragraphs: [
            'Lead with the decision the client is trying to make and any deadline that affects it. Summarize the facts that matter, with the source and date for each. Identify the exact question that remains open and explain what decision is waiting on the answer.',
            'Point the reviewing advisor to the relevant record in the approved location. Keep the TAC note focused on the handoff and use only the account details needed to distinguish records.',
          ],
        },
        {
          title: 'Assign the review and the client update',
          paragraphs: [
            'Give the reviewer a task with a named owner, a due date, and a clear deliverable. For example, ask them to reconcile a conflicting due date and document which source confirms it. Set the internal deadline early enough to give the client an update at the promised time.',
            'Name who will contact the client. If the reviewer cannot take the task or the deadline is at risk, have the referring advisor alert the team lead and confirm who will take over. Keep the client update on the calendar even if the review is still open.',
          ],
        },
        {
          title: 'Close the loop in TAC',
          paragraphs: [
            'Tell the client what has been verified, what is still being checked, and when they will hear from you again. If you reach voicemail or the client cannot respond, log the attempt and schedule the next contact.',
            'Record the review outcome with its source and date, then log what you told the client and any new commitment. Close the review task once its outcome is recorded. Keep any remaining action open with a named owner and due date.',
          ],
        },
      ],
      example: {
        situation: 'A fictional client named Casey wants to plan next week’s cash flow. A statement dated October 28 lists a payment due Friday. Casey says the account portal shows Monday, but has not shared a dated record from the portal. Casey expects an update Wednesday afternoon.',
        response: '“The October 28 statement shows Friday, and you saw Monday in the portal. We’ll check which date applies to this payment. I’ll update you by 3 p.m. Wednesday, even if we’re still waiting for confirmation.”',
        record: 'Casey needs the current due date for next week’s cash-flow plan. The October 28 statement lists Friday. Monday is client-reported. Assign the reviewing advisor to verify the date for the same account and billing period and record the source by noon Wednesday. The referring advisor owns the 3 p.m. update. If the review is still open at noon, the referring advisor alerts the team lead, gives Casey a status update as promised, and records the next check-in.',
      },
      exercise: {
        prompt: 'A fictional client wants to plan their next payment before leaving town Saturday. The latest statement verifies one loan’s payment amount and due date. The client believes a second payment is due while they are away, but the second account’s statement is missing. You promised an update by 4 p.m. Thursday. By noon Thursday, the reviewing advisor has no new record.',
        instruction: 'In a development practice household, draft a TAC handoff note and tasks for the review and client update. Then draft the Thursday update and log what you would do next if the second statement is still missing.',
        checklist: [
          'State the travel deadline, what the first statement verifies, and what is still unknown about the second account.',
          'Assign a named reviewer and a deadline before the client update. Specify the record to request and what to verify when it arrives.',
          'Name who will escalate the delay and who will update the client by 4 p.m. Thursday.',
          'Draft a status update that explains the open question and sets a next check-in. Keep the unresolved review task open with an owner and due date.',
        ],
      },
    },
    steps: [
      'Summarize the client’s goal, what you verified, and what is still uncertain.',
      'Identify any issue that needs an advisor or specialist review. Verify current guidance before relying on a program rule.',
      'Assign a next action and due date. Close the loop with the client once the review is complete.',
    ],
    scenario: 'The intake is complete, but one program detail needs verification before the advisor can discuss options.',
    question: 'What should the handoff contain?',
    choices: ['The verified facts, the unresolved question, and an assigned follow-up with a due date.', 'A note saying the case is complete.', 'A recommendation with no explanation of the remaining question.'],
    feedback: 'A handoff should explain what is known and make the unresolved work visible, assigned, and time bound.',
  },
] as const
