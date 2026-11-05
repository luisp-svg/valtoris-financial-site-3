export const PILOT_LESSONS = [
  {
    id: 'first-conversation',
    title: 'Prepare for the first conversation',
    goal: 'Turn a broad request for student loan help into a clear question to investigate.',
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
