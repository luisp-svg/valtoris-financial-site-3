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
