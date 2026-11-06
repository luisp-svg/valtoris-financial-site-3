export const CORE_LESSONS = [
  {
    id: 'core-valtoris',
    title: 'How Valtoris works',
    goal: 'Help a client find the right service and leave a clear next step in TAC.',
    material: {
      duration: '15–20 minutes',
      objectives: [
        'Identify the client’s immediate decision and any deadline.',
        'Explain the next conversation in plain language and route the need to the appropriate team.',
        'Leave a TAC record that another advisor can act on without repeating discovery.',
      ],
      sections: [
        {
          title: 'Start with the decision',
          paragraphs: [
            'A first conversation can surface several needs at once. Ask what prompted the call, what decision the client needs to make, and what has a deadline. Repeat the priority in the client’s words and confirm it before discussing a next step.',
            'Try asking, “If we could make progress on one thing this week, what would help most?” Follow with, “Is there a date or event we need to plan around?” If the client is unsure, capture that as an open question and agree on how to resolve it.',
          ],
        },
        {
          title: 'Route the need and set expectations',
          paragraphs: [
            'Match the immediate need to the right conversation. A commercial coverage question belongs with the property and casualty team. A question about organizing loan records for a review belongs with the student loan team. Confirm the receiving advisor when the assignment is unclear.',
            'Tell the client what the receiving advisor will review, what information would help, and when they can expect an update. For a second need, agree whether to address it later or make a separate introduction. Ask permission before sharing relevant context.',
          ],
        },
        {
          title: 'Use TAC to close the loop',
          paragraphs: [
            'Start by finding the existing household or contact. Add a concise note with the client’s goal and deadline. Use a task for the action someone must take. Use an opportunity when the team is tracking a specific service discussion through the pipeline.',
            'An actionable task names the work, the person responsible, and the due date. “Follow up” leaves the next advisor guessing. “Confirm who will review the renewal request and update the client by Thursday” gives the team a clear commitment.',
          ],
        },
      ],
      example: {
        situation: 'A fictional business owner wants to review commercial coverage before a renewal in two weeks. They also mention that student loan payments make budgeting harder.',
        response: '“The renewal is your first priority. I’ll confirm who can review your coverage request and update you by Thursday. Would you like us to set a separate conversation about your student loan questions after that?”',
        record: 'Review commercial coverage before renewal in two weeks. The referring advisor will confirm who can review the request and update the client by Thursday. Ask whether the client wants a separate student loan introduction.',
      },
      exercise: {
        prompt: 'A fictional client wants to discuss family protection and mentions that their business lease starts next Friday. They ask whether they need to provide proof of coverage before receiving the keys.',
        instruction: 'In a development practice record, draft a brief household note and a follow-up task. Write the sentence you would use to confirm the priority with the client.',
        checklist: [
          'Capture the client’s immediate decision and the lease date.',
          'Name the team you would contact and what it needs to verify.',
          'Give the next action an owner and a due date before the lease starts.',
          'Record the family protection conversation as a separate follow-up.',
        ],
      },
    },
    steps: [
      'Start by asking what the client wants to accomplish and what is time-sensitive.',
      'Check which Valtoris team handles the need. Explain what the next conversation will cover.',
      'Record the goal, next action, responsible person, and due date in TAC.',
    ],
    scenario: 'A business owner asks for help with several unrelated financial concerns in the same conversation.',
    question: 'What should you do first?',
    choices: ['Clarify their priorities and confirm which team should handle the first need.', 'Send the same request to every team.', 'Book a meeting without recording what they need.'],
    feedback: 'A clear priority and named owner give the client a useful next step.',
  },
  {
    id: 'core-referrals',
    title: 'Cross-selling and internal referrals',
    goal: 'Spot a related client need and make a referral the receiving team can act on.',
    steps: [
      'Connect the referral to a need the client mentioned. Explain why an introduction could help.',
      'Ask permission before sharing information and use the approved channel.',
      'Share the relevant goal and next step, then follow up on the handoff.',
    ],
    scenario: 'A client discussing protection mentions that student loan payments are making it hard to plan their budget.',
    question: 'How should you handle the additional need?',
    choices: ['Send their file to the student loan team immediately.', 'Ask whether they want an introduction and share the relevant context with permission.', 'Recommend a specific repayment plan on the spot.'],
    feedback: 'A referral starts with the client’s need and a clear, permission-based introduction.',
  },
  {
    id: 'core-marketing',
    title: 'Marketing and lead follow-up',
    goal: 'Plan a campaign with a clear audience, message, and follow-up.',
    steps: [
      'Choose an audience and one problem the campaign addresses.',
      'Use approved messaging and a single call to action. Confirm who will handle responses.',
      'Track the source and follow-up in TAC so the team can see what the campaign generated.',
    ],
    scenario: 'You are preparing an event invitation for local business owners.',
    question: 'What should be ready before the invitation goes out?',
    choices: ['A broad message covering every service.', 'A list of recipients and a plan to decide what to do after the event.', 'An approved message, a clear response path, and an owner for follow-up.'],
    feedback: 'The invitation and follow-up should work together so interested people know what happens next.',
  },
  {
    id: 'core-networking',
    title: 'Networking and partnerships',
    goal: 'Turn a useful introduction into a next step you can follow through on.',
    steps: [
      'Learn who a potential partner serves and where your work overlaps.',
      'Agree on a specific next step. Ask how they prefer to be contacted.',
      'Record the commitment and follow up when you said you would.',
    ],
    scenario: 'At a networking event, a potential referral partner offers to introduce you to a colleague.',
    question: 'What should you do next?',
    choices: ['Confirm the purpose of the introduction, agree on who will make it, and set a follow-up date.', 'Add both people to a campaign without asking.', 'Wait for the partner to remember the conversation.'],
    feedback: 'A specific commitment and follow-up date make it easier for both people to keep the introduction moving.',
  },
] as const
