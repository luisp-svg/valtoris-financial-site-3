export const STUDENT_LOAN_EXAM_QUESTIONS = [
  {
    prompt: 'A client asks for a lower payment and mentions an upcoming job change. What should you do first?',
    choices: ['Clarify the decision and deadline, then request the records needed for review.', 'Suggest a repayment plan immediately.', 'Wait until the job change is complete before documenting the request.'],
  },
  {
    prompt: 'Two documents show different balances and cover different dates. How should you handle them?',
    choices: ['Record each source and date, and confirm which accounts each covers.', 'Average the balances.', 'Use the larger figure without recording the discrepancy.'],
  },
  {
    prompt: 'A couple sends statements for both spouses. What makes the intake easier to verify?',
    choices: ['Combine both sets of loans under one name.', 'Record only the combined monthly payment.', 'Keep each borrower and account distinct and record the source of each figure.'],
  },
  {
    prompt: 'A client offers to send their account password so you can review their loans. What should you do?',
    choices: ['Ask them to share the relevant statements through the approved intake channel.', 'Save the password with the case notes.', 'Forward the password to the next reviewer.'],
  },
  {
    prompt: 'A program rule needs confirmation before you can discuss options. What belongs in the handoff?',
    choices: ['A recommendation based on memory.', 'The unresolved question, the verification task, and who owns it.', 'A note marking the case complete.'],
  },
  {
    prompt: 'The client is waiting while an advisor reviews an open question. What should the follow-up record include?',
    choices: ['Only the date of the original intake.', 'A reminder without an owner.', 'An assigned next step, due date, and plan to update the client.'],
  },
  {
    prompt: 'What should another advisor be able to tell from your case summary?',
    choices: ['Only the most recent balance.', 'Only the recommendation you expect to make.', 'The client’s goal, the facts verified, the open questions, and the next action.'],
  },
] as const
