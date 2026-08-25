import type { SpecializedCopyCatalog, SpecializedProductCopy } from '../specialized/types'

const RETIREMENT_COPY_EN: SpecializedCopyCatalog = {
  questions: {},
  helpers: {
    welcome:
      'Answer a focused set of questions about your timeline, savings, income sources, investments, taxes, healthcare, and legacy planning. Most people finish in about 4–6 minutes.',
    welcomeNote:
      'Results are educational estimates based on the information you provide and standard planning assumptions. They do not guarantee retirement outcomes.',
    step2:
      'Tell us about your household and when you plan to retire so we can personalize your projections.',
    step3:
      'Share your current income and estimated retirement spending so we can model income adequacy.',
    step4: 'Tell us about your current retirement balances and contribution habits.',
    step5:
      'Estimate the monthly income you expect in retirement (today’s dollars). Guaranteed sources are weighted more heavily than other or temporary income.',
    step6:
      'Review the default projection assumptions used in your report, then select your top retirement priorities.',
    step7: 'Share how you invest today and how your accounts are structured for tax flexibility.',
    step8:
      'Review healthcare readiness and the documents that protect your family and legacy goals.',
    step9: 'Share how we can reach you, then view your personalized Retirement Report Card™.',
    alreadyRetiredNote:
      'Because you indicated you are already retired, we will focus on sustainability, withdrawals, healthcare, taxes, and legacy rather than a future start date.',
    spendingFallback:
      'Optional. If left blank, we estimate retirement spending as 80% of your current annual gross income (converted to a monthly amount). You can refine this later.',
    guaranteedIncome:
      'Social Security, pension, and annuity income that is expected to continue for life (or a long contractual period).',
    otherIncome:
      'Recurring income that may support retirement but is generally less guaranteed than Social Security, pension, or annuity payments.',
    partTimeIncome:
      'Part-time or consulting income is treated as temporary and is not counted as lifetime guaranteed coverage when estimating required nest egg.',
    assumptions:
      'These assumptions produce hypothetical educational estimates. Actual market returns, inflation, longevity, and personal circumstances will differ. Results do not guarantee retirement outcomes. Version one does not model detailed COLA growth for individual income sources.',
  },
  fields: {
    state: 'State',
    maritalStatus: 'Marital Status',
    alreadyRetired: 'Are you already retired?',
    currentAge: 'Current Age',
    targetRetirementAge: 'Target Retirement Age',
    spouseAge: 'Spouse Age (optional)',
    spouseTargetRetirementAge: 'Spouse Target Retirement Age (optional)',
    retirementLifestyle: 'What lifestyle are you planning for in retirement?',
    planClarity: 'How clear is your retirement plan today?',
    primaryMotivation: 'What is your primary retirement motivation?',
    currentAnnualGrossIncome: 'Current Annual Gross Household Income',
    estimatedMonthlyRetirementSpending: 'Estimated Monthly Retirement Spending',
    debtBurden: 'How would you describe your current consumer debt burden?',
    currentRetirementSavings: 'Current Retirement Savings (all accounts)',
    monthlyContribution: 'Monthly Retirement Contribution',
    employerMatch: 'Do you receive an employer retirement match?',
    contributionConsistency: 'How consistently do you contribute?',
    socialSecurityMonthly: 'Estimated Monthly Social Security',
    spouseSocialSecurityMonthly: 'Spouse Estimated Monthly Social Security (optional)',
    pensionMonthly: 'Estimated Monthly Pension',
    annuityMonthly: 'Estimated Monthly Annuity Income',
    socialSecurityEstimateReviewed: 'Have you reviewed an official Social Security estimate?',
    pensionElectionUnderstood: 'Do you understand your pension election options?',
    survivorContinuation: 'Is survivor continuation coverage in place or planned?',
    rentalIncomeMonthly: 'Estimated Monthly Rental Income',
    businessIncomeMonthly: 'Estimated Monthly Business Income',
    otherRecurringIncomeMonthly: 'Other Recurring Monthly Income',
    expectsPartTimeWork: 'Do you expect temporary part-time or consulting income in retirement?',
    estimatedMonthlyPartTimeIncome: 'Estimated Monthly Part-Time Income',
    expectedPartTimeWorkYears: 'Expected Years of Part-Time Work',
    inflationAwareness: 'Have you reviewed how inflation may affect your retirement income?',
    goals: 'What are your top retirement priorities? (Select up to 3)',
    riskTolerance: 'How would you describe your investment risk tolerance?',
    diversification: 'How diversified are your retirement investments?',
    allocationReview: 'When did you last formally review your allocation?',
    accountTypes: 'Which retirement account types do you currently use?',
    taxPlanning: 'How would you describe your tax planning for retirement?',
    rothUsage: 'How actively do you use Roth contributions or conversions?',
    medicareReadiness: 'How prepared are you for Medicare enrollment and planning?',
    longTermCarePlan: 'What is your long-term-care funding approach?',
    hsaBalance: 'Current HSA Balance',
    hasWill: 'Do you have a will?',
    hasTrust: 'Do you have a trust?',
    beneficiariesReviewed:
      'Have you reviewed beneficiaries on major accounts in the last 2–3 years?',
    hasPowerOfAttorney: 'Do you have a durable power of attorney?',
    legacyIntent: 'How would you describe your legacy / inheritance intent?',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    preferredContactMethod: 'Preferred Contact Method',
    bestContactTime: 'Best Contact Time',
    primaryConcern: 'Primary Retirement Concern (optional)',
    consent: 'Consent',
    guaranteedIncomeHeading: 'Guaranteed Income',
    otherIncomeHeading: 'Other Expected Income',
    partTimeIncomeHeading: 'Temporary / Part-Time Income',
    assumptionsHeading: 'Default Projection Assumptions',
    investmentsHeading: 'Investment Risk & Diversification',
    taxHeading: 'Tax Diversification & Efficiency',
    healthcareHeading: 'Healthcare & Long-Term Care',
    estateHeading: 'Estate, Beneficiaries & Legacy',
  },
  answers: {
    yes: 'Yes',
    no: 'No',
    'maritalStatus.single': 'Single',
    'maritalStatus.married': 'Married',
    'maritalStatus.divorced': 'Divorced',
    'maritalStatus.widowed': 'Widowed',
    'maritalStatus.domestic-partnership': 'Domestic Partnership',
    'alreadyRetired.yes': 'Yes — I am already retired',
    'alreadyRetired.no': 'No — I am still working toward retirement',
    'retirementLifestyle.essential': 'Essential / needs-focused',
    'retirementLifestyle.comfortable': 'Comfortable',
    'retirementLifestyle.affluent': 'Affluent',
    'retirementLifestyle.luxury': 'Luxury / dream lifestyle',
    'planClarity.very-clear': 'Very clear written plan',
    'planClarity.somewhat-clear': 'Somewhat clear direction',
    'planClarity.unclear': 'Unclear / still figuring it out',
    'planClarity.no-plan': 'No plan yet',
    'primaryMotivation.income-security': 'Secure lifetime income',
    'primaryMotivation.leave-workforce': 'Leave the workforce on my terms',
    'primaryMotivation.travel-lifestyle': 'Travel and lifestyle freedom',
    'primaryMotivation.family-legacy': 'Support family and leave a legacy',
    'primaryMotivation.reduce-stress': 'Reduce financial stress',
    'debtBurden.none': 'No meaningful consumer debt',
    'debtBurden.low': 'Low — manageable payments',
    'debtBurden.moderate': 'Moderate — limits flexibility',
    'debtBurden.high': 'High — creates pressure',
    'employerMatch.full-match': 'Yes — I capture the full match',
    'employerMatch.partial-match': 'Yes — but I do not capture the full match',
    'employerMatch.no-match-offered': 'No employer match offered',
    'employerMatch.not-participating': 'Match available, but I am not participating',
    'employerMatch.self-employed': 'Self-employed / no employer plan',
    'employerMatch.unsure': 'Not sure',
    'contributionConsistency.always': 'Every paycheck / always',
    'contributionConsistency.most-months': 'Most months',
    'contributionConsistency.sometimes': 'Sometimes',
    'contributionConsistency.rarely': 'Rarely',
    'contributionConsistency.not-saving': 'Not currently contributing',
    'yesNoUnsure.yes': 'Yes',
    'yesNoUnsure.no': 'No',
    'yesNoUnsure.unsure': 'Not sure',
    'yesNoNaUnsure.yes': 'Yes',
    'yesNoNaUnsure.no': 'No',
    'yesNoNaUnsure.na': 'Not applicable',
    'yesNoNaUnsure.unsure': 'Not sure',
    'expectsPartTime.yes': 'Yes — expecting temporary part-time or consulting income',
    'expectsPartTime.no': 'No',
    'riskTolerance.conservative': 'Conservative',
    'riskTolerance.moderate': 'Moderate',
    'riskTolerance.growth': 'Growth-oriented',
    'riskTolerance.aggressive': 'Aggressive',
    'riskTolerance.unsure': 'Not sure',
    'diversification.well-diversified': 'Well diversified across asset classes',
    'diversification.somewhat': 'Somewhat diversified',
    'diversification.concentrated': 'Concentrated in a few holdings',
    'diversification.unsure': 'Not sure',
    'allocationReview.within-year': 'Reviewed within the last year',
    'allocationReview.1-3-years': '1–3 years ago',
    'allocationReview.over-3-years': 'More than 3 years ago',
    'allocationReview.never': 'Never formally reviewed',
    'allocationReview.unsure': 'Not sure',
    'accountTypes.traditional': 'Traditional 401(k) / IRA',
    'accountTypes.roth': 'Roth 401(k) / Roth IRA',
    'accountTypes.taxable': 'Taxable brokerage',
    'accountTypes.hsa': 'HSA',
    'accountTypes.pension': 'Pension / defined benefit',
    'accountTypes.annuity': 'Annuity',
    'accountTypes.none': 'No retirement accounts yet',
    'taxPlanning.proactive': 'Proactive multi-year tax planning',
    'taxPlanning.annual-review': 'Annual review with limited planning',
    'taxPlanning.compliance-only': 'File and pay only',
    'taxPlanning.none': 'No tax planning for retirement',
    'rothUsage.regular': 'Regular Roth contributions or conversions',
    'rothUsage.some': 'Some Roth balance, infrequent additions',
    'rothUsage.none': 'No Roth assets',
    'rothUsage.unsure': 'Not sure',
    'medicareReadiness.researched': 'Researched / enrollment plan ready',
    'medicareReadiness.somewhat': 'Somewhat familiar',
    'medicareReadiness.not-yet': 'Not yet explored',
    'medicareReadiness.already-enrolled': 'Already enrolled in Medicare',
    'medicareReadiness.years-away': 'Years away — not applicable yet',
    'longTermCarePlan.has-coverage': 'Has LTC insurance or funded plan',
    'longTermCarePlan.self-fund': 'Plan to self-fund from assets',
    'longTermCarePlan.family-support': 'Expect family support',
    'longTermCarePlan.no-plan': 'No plan yet',
    'longTermCarePlan.unsure': 'Not sure',
    'legacyIntent.strong': 'Strong legacy / inheritance goals',
    'legacyIntent.moderate': 'Moderate — leave something if possible',
    'legacyIntent.spend-down': 'Prefer to spend down assets',
    'legacyIntent.unsure': 'Not sure',
    'goals.close-income-gap': 'Close my retirement income gap',
    'goals.increase-savings': 'Increase savings rate',
    'goals.diversify-taxes': 'Improve tax diversification',
    'goals.reduce-investment-risk': 'Align investment risk',
    'goals.plan-healthcare': 'Plan healthcare & long-term care',
    'goals.protect-legacy': 'Protect beneficiaries & legacy',
    'goals.clarify-timeline': 'Clarify retirement timeline',
    'goals.maximize-income-sources': 'Maximize income sources',
    'contactMethod.email': 'Email',
    'contactMethod.phone': 'Phone call',
    'contactMethod.text': 'Text message',
    'contactMethod.either': 'Email or phone — whichever is convenient',
    'contactTime.morning': 'Morning (8am–12pm)',
    'contactTime.afternoon': 'Afternoon (12pm–5pm)',
    'contactTime.evening': 'Evening (5pm–8pm)',
    'contactTime.anytime': 'Anytime',
  },
  placeholders: {
    currentAge: '55',
    targetRetirementAge: '65',
    spouseAge: '53',
    spouseTargetRetirementAge: '65',
    income: '150,000',
    spending: '6,500',
    savings: '320,000',
    contribution: '900',
    socialSecurity: '2,300',
    spouseSocialSecurity: '1,500',
    zero: '0',
    partTimeIncome: '800',
    partTimeYears: '3',
    hsa: '8,000',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'you@email.com',
    phone: '(555) 555-5555',
    primaryConcern: 'e.g., closing my income gap',
  },
  validation: {
    consentRequired: 'Please confirm the required acknowledgments before continuing.',
    submitFailed: 'We could not save your Retirement Report Card™. Please try again.',
    retry: 'Try again',
    ingestUnavailable:
      'Your answers were reviewed on this device. They were not sent to Valtoris CRM.',
    ageOrder: 'Target retirement age must be greater than or equal to your current age.',
    contactConsent:
      'I understand these results are educational estimates for planning purposes and do not guarantee retirement outcomes. Valtoris may contact me about my Retirement Report Card™ using the preferences I provided.',
  },
  ui: {
    welcomeTitle: 'Start Your Retirement Report Card™',
    startCta: 'Get My Retirement Score',
    backToOverview: 'Back to Overview',
    back: 'Back',
    continue: 'Continue',
    viewResults: 'View My Retirement Report Card',
    saving: 'Saving your Retirement Report Card…',
    stepIndicator: 'Step {current} of {total}',
    languageGroupLabel: 'Language',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    consentHeading: 'Acknowledgments',
    consentIntro:
      'Your Retirement Report Card™ is based on the information you shared. Required acknowledgments are marked with an asterisk.',
    consentStorage:
      'I understand that Valtoris will use the information I provide to calculate and store my {storageResultName} and related results.',
    consentStorageHint: 'Required acknowledgment to save and calculate your report card.',
    consentStorageError:
      'Please acknowledge that your information will be used to calculate and store your report card.',
    consentContact:
      'I give Valtoris permission to contact me about my results and possible next steps.',
    consentEmailMarketing:
      'I agree to receive occasional marketing emails from Valtoris. I can unsubscribe at any time.',
    consentSms:
      'I agree to receive recurring marketing text messages from Valtoris at the number provided. Consent is not a condition of receiving my report. Message and data rates may apply. Reply STOP to opt out.',
    consentSmsPhoneNote: 'Add a phone number earlier in the assessment to enable this option.',
    consentPrivacyBefore: 'I acknowledge that I have reviewed the',
    consentPrivacyLink: 'Valtoris Privacy Policy',
    consentPrivacyAfter: '.',
    consentPrivacyHint: 'Required privacy acknowledgment. Opens the Privacy Policy in a new tab.',
    consentPrivacyError: 'Please review and acknowledge the Privacy Policy before continuing.',
    consentDisclaimer:
      'Results are educational estimates based on self-reported information and standard planning assumptions. They are not financial, legal, tax, investment, credit, or insurance advice, and they do not guarantee retirement outcomes. An advisor review may reach different conclusions.',
    consentHoneypot: 'Company website',
    productTitle: 'Retirement Report Card™',
    storageResultName: 'Retirement Report Card',
    step2Title: 'Household & Retirement Timeline',
    step3Title: 'Income & Retirement Spending',
    step4Title: 'Retirement Savings',
    step5Title: 'Retirement Income Sources',
    step6Title: 'Income Sustainability',
    step7Title: 'Investments & Taxes',
    step8Title: 'Healthcare, Protection & Legacy',
    step9Title: 'Contact & Results',
    landingEyebrow: 'VALTORIS RETIREMENT REPORT CARD™',
    landingTitle: 'Are You on Track to Retire With Confidence?',
    landingHero1:
      'Take the Valtoris Retirement Report Card™ to evaluate your retirement income, savings progress, Social Security, pension decisions, investment risk, tax diversification, healthcare readiness, and legacy planning.',
    landingHero2:
      'See what appears to be on track, where important gaps may exist, and what to address next.',
    landingMicrocopy:
      'Takes approximately 4–6 minutes. No cost. No obligation. Results are estimates, not guarantees.',
    landingReceiveHeading: "What You'll Receive",
    landingReceiveLead:
      'Four deliverables designed to turn a short assessment into clearer retirement direction.',
    landingReceive1Title: 'Retirement Readiness Score',
    landingReceive1Description:
      'An overall score and letter grade that summarizes how prepared your plan appears today.',
    landingReceive2Title: 'Income-Gap Analysis',
    landingReceive2Description:
      'A clear view of projected retirement spending need versus expected income sources.',
    landingReceive3Title: 'Category-by-Category Review',
    landingReceive3Description:
      'Eight retirement categories scored so you can see strengths and gaps side by side.',
    landingReceive4Title: 'Personalized Action Blueprint',
    landingReceive4Description:
      'Immediate, 30-day, and 90-day priorities tailored to your answers and timeline.',
    landingSampleHeading: 'Sample Report Preview',
    landingSampleLead:
      'An illustrative look at the score, category detail, and action plan you can expect.',
    landingSampleBadge: 'Sample Report Preview',
    landingSampleAriaLabel: 'Sample Retirement Report Card preview',
    landingSampleScore: 'Overall Score',
    landingSampleGrade: 'Grade',
    landingSampleReadiness: 'Important Gaps to Address',
    landingSampleStrongest: 'Strongest Area',
    landingSamplePriority: 'Priority Area',
    landingSampleRetirementAge: 'Retirement Age',
    landingSampleMonthlyNeed: 'Projected Monthly Need',
    landingSampleMonthlyIncome: 'Estimated Monthly Income',
    landingSampleMonthlyGap: 'Estimated Monthly Gap',
    landingSampleFundedRatio: 'Funded Ratio',
    landingSampleBarsLabel: 'Sample retirement category scores',
    landingSampleBarSavings: 'Savings Progress',
    landingSampleBarIncomeSources: 'Income Sources',
    landingSampleBarSustainability: 'Income Sustainability',
    landingSampleBarInvestments: 'Investments',
    landingSampleImmediate: 'Immediate Priorities',
    landingSample30: '30-Day Action Plan',
    landingSample90: '90-Day Action Plan',
    landingSampleImmediate1: 'Confirm Social Security estimates',
    landingSampleImmediate2: 'Review the projected retirement-income gap',
    landingSample30_1: 'Increase contributions by 2%',
    landingSample30_2: 'Consolidate retirement account information',
    landingSample30_3: 'Review investment risk',
    landingSample90_1: 'Build a written retirement-income strategy',
    landingSample90_2: 'Evaluate tax-diversification opportunities',
    landingSample90_3: 'Complete healthcare and estate-planning review',
    landingSampleDisclaimer:
      'Illustrative sample only. Your personalized results will reflect your answers. These estimates do not guarantee retirement outcomes.',
    landingCategoriesHeading: 'Eight Retirement Categories',
    landingCategoriesLead:
      'Your Report Card reviews the eight areas that shape a coordinated retirement foundation.',
    landingCategory1Title: 'Retirement Vision & Timeline',
    landingCategory1Description:
      'Clarify lifestyle goals, plan clarity, and your intended retirement date.',
    landingCategory2Title: 'Savings & Contribution Progress',
    landingCategory2Description:
      'Evaluate balances, contribution habits, and employer-match utilization.',
    landingCategory3Title: 'Retirement Income Sources',
    landingCategory3Description:
      'Review Social Security, pension, annuity, and other expected income streams.',
    landingCategory4Title: 'Income Adequacy & Sustainability',
    landingCategory4Description:
      'Compare projected income to spending need under standard planning assumptions.',
    landingCategory5Title: 'Investment Risk & Diversification',
    landingCategory5Description:
      'Assess risk posture, diversification, and allocation review habits.',
    landingCategory6Title: 'Tax Diversification & Efficiency',
    landingCategory6Description: 'Look at account types, Roth usage, and tax-planning readiness.',
    landingCategory7Title: 'Healthcare & Long-Term-Care Readiness',
    landingCategory7Description:
      'Check Medicare readiness, HSA balances, and long-term-care planning.',
    landingCategory8Title: 'Estate, Beneficiaries & Legacy',
    landingCategory8Description:
      'Review wills, trusts, powers of attorney, beneficiaries, and legacy intent.',
    landingHowHeading: 'How It Works',
    landingHowLead: 'From your first answers to a clearer next step in four focused stages.',
    landingHow1Title: 'Answer Questions',
    landingHow1Description:
      'Share focused details about your timeline, savings, income, and protection.',
    landingHow2Title: 'Receive Results',
    landingHow2Description:
      'Get your retirement score, grade, and category breakdown immediately.',
    landingHow3Title: 'Review Blueprint',
    landingHow3Description:
      'See what appears on track, where gaps may exist, and what to prioritize next.',
    landingHow4Title: 'Schedule Strategy Session',
    landingHow4Description:
      'Optionally review your results in a complimentary strategy conversation.',
    landingFaqHeading: 'Frequently Asked Questions',
    landingFaqLead: 'Straightforward answers before you begin.',
    landingFaq1: 'How long does the Retirement Report Card take?',
    landingFaqA1: 'Most people finish in about 4–6 minutes. No account creation is required.',
    landingFaq2: 'Is it free?',
    landingFaqA2: 'Yes. The Valtoris Retirement Report Card™ is complimentary with no obligation.',
    landingFaq3: 'Are the projections guaranteed?',
    landingFaqA3:
      'No. Results are educational estimates based on your answers and standard planning assumptions. They do not guarantee retirement outcomes.',
    landingFaq4: 'Do I need exact account balances?',
    landingFaqA4:
      'Approximate figures are fine. More accurate inputs produce more useful estimates, but you can refine details later.',
    landingFaq5: 'Do I have to purchase anything?',
    landingFaqA5: 'No. You receive your results whether or not you choose to take a next step.',
    landingFaq6: 'Will someone contact me?',
    landingFaqA6:
      'Only if you provide contact preferences and consent. Completing the report card alone does not create a sales commitment.',
    landingFaq7: 'Can I retake it later?',
    landingFaqA7: 'Yes. You can retake the assessment anytime your situation changes.',
    landingClosingTitle: 'Ready to See Where Your Retirement Stands?',
    landingClosingCopy:
      'Take the first step and receive a clearer picture of your score, income gap, and next priorities.',
    landingClosingMicrocopy:
      'Takes approximately 4–6 minutes. No cost. No obligation. Results are estimates, not guarantees.',
    resultsDiagnosticLabel: 'Retirement Report Card™ · Retirement Readiness Diagnostic',
    resultsDisclaimer:
      'These results are educational estimates based on self-reported information and standard planning assumptions. They are not financial, legal, tax, investment, credit, or insurance advice, and they do not guarantee retirement outcomes. An advisor review may reach different conclusions.',
    resultsScheduleTitle: 'Schedule Complimentary Strategy Session™',
    resultsScheduleCopy:
      'Review your Retirement Report Card™ with a Valtoris strategist and receive a customized action plan for strengthening retirement income readiness.',
    resultsRetake: 'Retake Assessment',
    preparedFor: 'Prepared for {name}',
    sampleGreeting: 'Sample Retirement Report Card',
  },
  results: {
    title: 'Retirement Report Card™',
    scoreLabel: 'Retirement Readiness Score™',
    glanceLead: 'Your retirement readiness across eight planning categories.',
    prioritiesTitle: 'Top 3 Retirement Priorities™',
    prioritiesLead: 'Highest-impact next steps based on your answers and projection metrics.',
    impactLabel: 'Retirement Impact',
    actionPlanTitle: 'Retirement Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day priorities tailored to your profile.',
    categoriesTitle: 'Category Details',
    categoriesLead:
      'Expand each category for status, guidance, and recommended next steps. Status labels are educational readiness indicators—not guarantees.',
    blueprintTitle: 'Retirement Blueprint™',
    blueprintCopyNamed:
      'This report helps {name} identify what appears on track, where gaps may exist, and what to address next—using educational estimates, not guarantees.',
    blueprintCopyGeneric:
      'This report helps identify what appears on track, where gaps may exist, and what to address next—using educational estimates, not guarantees.',
    statusMetricLabel: 'Readiness',
    recommendationsSubhead: 'Next steps',
    footer1: 'Powered by Valtoris Financial™',
    footer2: 'Helping Families Plan Retirement Income With Clarity™',
    'category.vision': 'Retirement Vision & Timeline',
    'category.savings': 'Savings & Contribution Progress',
    'category.income-sources': 'Retirement Income Sources',
    'category.income-adequacy': 'Income Adequacy & Sustainability',
    'category.investments': 'Investment Risk & Diversification',
    'category.tax': 'Tax Diversification & Efficiency',
    'category.healthcare': 'Healthcare & Long-Term-Care Readiness',
    'category.estate': 'Estate, Beneficiaries & Legacy',
    'summary.vision.high': 'Your retirement vision and timeline appear clear and actionable.',
    'summary.vision.mid': 'You have a direction, but timeline clarity could be stronger.',
    'summary.vision.low': 'Retirement vision or timeline clarity needs meaningful attention.',
    'summary.savings.high':
      'Savings balances and contribution habits look strong for your timeline.',
    'summary.savings.mid': 'You are saving, but contribution progress may need acceleration.',
    'summary.savings.low':
      'Savings and contribution progress appear limited relative to retirement need.',
    'summary.income-sources.high':
      'Reliable income sources appear well aligned with spending need.',
    'summary.income-sources.mid':
      'Income sources exist, but coverage or reliability can improve.',
    'summary.income-sources.low': 'Income reliability or spending coverage appears limited.',
    'summary.income-adequacy.high':
      'Projected retirement income appears adequate relative to your spending target.',
    'summary.income-adequacy.mid':
      'Income may cover most needs, but a sustainability gap remains.',
    'summary.income-adequacy.low':
      'A meaningful retirement income gap may threaten long-term sustainability.',
    'summary.investments.high':
      'Investment risk and diversification appear aligned with your timeline.',
    'summary.investments.mid':
      'Allocation is workable, but risk or review cadence may need attention.',
    'summary.investments.low':
      'Investment risk, concentration, or review habits may undermine readiness.',
    'summary.tax.high': 'Tax location diversity and planning habits look strong.',
    'summary.tax.mid': 'Some tax diversification exists, with room to improve efficiency.',
    'summary.tax.low': 'Tax diversification or planning appears limited.',
    'summary.healthcare.high':
      'Healthcare and long-term-care readiness appear thoughtfully addressed.',
    'summary.healthcare.mid': 'Some healthcare planning is in place, but gaps may remain.',
    'summary.healthcare.low':
      'Healthcare or long-term-care planning needs attention before or during retirement.',
    'summary.estate.high': 'Estate documents and beneficiary planning appear in solid shape.',
    'summary.estate.mid': 'Some estate elements are in place, but updates may be needed.',
    'summary.estate.low': 'Estate documents, beneficiaries, or legacy intent need attention.',
    'guidance.vision':
      'A clear vision and realistic timeline guide savings, income design, and risk decisions.',
    'guidance.savings.retired':
      'In retirement, focus on sustainable withdrawals and preserving portfolio longevity.',
    'guidance.savings.working':
      'Consistent contributions and employer-match capture compound into long-term readiness.',
    'guidance.income-sources':
      'Guaranteed income (Social Security, pension, annuity) is weighted more heavily than rental, business, or temporary earned income.',
    'guidance.income-adequacy.retired':
      'Already-retired analysis emphasizes current spending coverage, withdrawal sustainability, and longevity.',
    'guidance.income-adequacy.working':
      'Adequacy compares entered retirement income plus portfolio withdrawals to inflated spending need when years remain until retirement.',
    'guidance.investments.retired':
      'In retirement, prioritize withdrawal strategy and sequence-of-returns risk management.',
    'guidance.investments.working':
      'Risk should match time horizon, and diversification should be reviewed on a set cadence.',
    'guidance.tax.retired':
      'In retirement, tax-efficient withdrawal sequencing can extend portfolio longevity.',
    'guidance.tax.working':
      'Mixing pre-tax, Roth, and taxable buckets improves flexibility in retirement.',
    'guidance.healthcare':
      'Healthcare and LTC costs are among the largest retirement uncertainties.',
    'guidance.estate':
      'Clear documents and updated beneficiaries protect family and legacy goals.',
    'rec.vision.high1': 'Review your written retirement vision annually.',
    'rec.vision.high2': 'Confirm timeline assumptions after major life changes.',
    'rec.vision.low1':
      'Write a one-page retirement vision with a target date and lifestyle definition.',
    'rec.vision.low2': 'Stress-test your retirement age against savings and income capacity.',
    'rec.savings.highRetired1': 'Maintain a written withdrawal policy.',
    'rec.savings.highRetired2': 'Revisit spending annually against portfolio income.',
    'rec.savings.highWorking1': 'Raise contributions with each raise or bonus.',
    'rec.savings.highWorking2': 'Keep capturing any available employer match.',
    'rec.savings.none1': 'Open or fund a retirement account and automate a starter contribution.',
    'rec.savings.none2': 'Capture any available employer match immediately.',
    'rec.savings.lowRetired1': 'Review withdrawal rate against longevity age {longevityAge}.',
    'rec.savings.lowRetired2': 'Identify discretionary spending that can flex with markets.',
    'rec.savings.lowWorking1': 'Increase monthly contributions by 1–2% of income.',
    'rec.savings.lowWorking2': 'Automate transfers on payday and review match utilization.',
    'rec.income-sources.high1':
      'Coordinate claiming and survivor strategies across household earners.',
    'rec.income-sources.high2': 'Revisit income-source reliability every 2–3 years.',
    'rec.income-sources.low1':
      'Improve the share of retirement spending covered by guaranteed income.',
    'rec.income-sources.low2':
      'Confirm Social Security estimates, pension elections, survivor options, and inflation impact on income.',
    'rec.income-adequacy.high1': 'Re-run projections after major income or spending changes.',
    'rec.income-adequacy.high2': 'Stress-test longevity and inflation assumptions.',
    'rec.income-adequacy.gap1': 'Prioritize closing the estimated {gap} annual income gap.',
    'rec.income-adequacy.gap2':
      'Combine higher savings, delayed retirement, and spending adjustments as needed.',
    'rec.income-adequacy.ok1':
      'Confirm expense assumptions and withdrawal rate with an advisor.',
    'rec.income-adequacy.ok2': 'Document a sustainable lifetime income plan.',
    'rec.investments.high1': 'Keep a written allocation policy and rebalance annually.',
    'rec.investments.high2': 'Avoid concentration drift into single holdings.',
    'rec.investments.low1':
      'Review asset allocation against your years-to-retirement horizon.',
    'rec.investments.low2':
      'Diversify concentrated positions and set a recurring review schedule.',
    'rec.tax.high1': 'Continue multi-year Roth and bracket management.',
    'rec.tax.high2': 'Coordinate withdrawals across account types.',
    'rec.tax.low1':
      'Build balances across Traditional, Roth, and taxable accounts where eligible.',
    'rec.tax.low2': 'Add a simple annual tax-planning review for retirement withdrawals.',
    'rec.healthcare.high1': 'Revisit Medicare and LTC assumptions every few years.',
    'rec.healthcare.high2': 'Preserve HSA funds for qualified medical costs when possible.',
    'rec.healthcare.low1': 'Document a Medicare transition plan and estimated premiums.',
    'rec.healthcare.low2':
      'Choose a long-term-care funding approach (insurance, self-fund, or hybrid).',
    'rec.estate.high1': 'Review estate documents every 3–5 years or after life changes.',
    'rec.estate.high2': 'Confirm contingent beneficiaries on all accounts.',
    'rec.estate.low1': 'Update wills, powers of attorney, and beneficiary designations.',
    'rec.estate.low2': 'Document legacy intent and align account titling accordingly.',
    'explanation.vision.retired':
      'You indicated you are already retired. Scoring emphasizes clarity of your current retirement plan rather than a future start date.',
    'explanation.vision.working':
      'You reported retiring in about {years} {yearWord} (age {currentAge} → {retirementAge}).',
    'explanation.savings':
      'Current retirement savings: {savings}. Monthly contributions: {contribution}.',
    'explanation.income-sources':
      'Guaranteed monthly income: {guaranteed} ({coverage} of spending). Other expected monthly income: {other}{partTimeNote}.',
    'explanation.incomeSourcesPartTime': ' (includes temporary part-time income)',
    'explanation.income-adequacy':
      'Target monthly spending: {target}. Expected income before portfolio: {beforePortfolio}. Total projected monthly income: {total}. Estimated annual gap: {gap}.',
    'explanation.investments':
      'Reported risk posture: {risk}; diversification: {diversification}.',
    'explanation.tax': 'Account types selected: {types}.',
    'explanation.healthcare':
      'Medicare readiness: {medicare}. Long-term care plan: {longTermCare}. HSA balance: {hsa}.',
    'explanation.estate':
      'Will: {will}; Trust: {trust}; Beneficiaries reviewed: {beneficiaries}; Power of attorney: {powerOfAttorney}.',
    'year.one': 'year',
    'year.many': 'years',
    unspecified: 'unspecified',
    notAvailable: 'n/a',
    none: 'none',
    'priority.vision.title': 'Clarify Retirement Vision & Timeline',
    'priority.vision.why':
      'An unclear vision or timeline makes savings and income decisions harder to coordinate.',
    'priority.vision.impact':
      'Creates a decision framework for savings rate, risk, and retirement date.',
    'priority.vision.timeline': 'Recommended within 30 days',
    'priority.savings.title': 'Accelerate Savings & Contributions',
    'priority.savings.why':
      'Current balances or contribution habits may not support your retirement income target.',
    'priority.savings.impact': 'Improves projected nest egg and reduces future income gaps.',
    'priority.savings.timeline': 'Recommended within 30–60 days',
    'priority.incomeSources.title': 'Strengthen Reliable Retirement Income',
    'priority.incomeSources.why':
      'Guaranteed income coverage or benefit understanding may leave spending exposed.',
    'priority.incomeSources.impact': 'Improves reliability of lifetime cash flow in retirement.',
    'priority.incomeSources.timeline': 'Recommended within 60–90 days',
    'priority.incomeAdequacy.title': 'Close Your Retirement Income Gap',
    'priority.incomeAdequacy.why':
      'Projected income may fall short of your retirement spending need.',
    'priority.incomeAdequacy.impact':
      'Improves the odds of sustaining lifestyle through longevity age {longevityAge}.',
    'priority.incomeAdequacy.timeline': 'Recommended within 30–60 days',
    'priority.investments.title': 'Align Investment Risk & Diversification',
    'priority.investments.why':
      'Risk posture, concentration, or review cadence may not match your timeline.',
    'priority.investments.impact':
      'Reduces sequence-of-returns and concentration risk near or in retirement.',
    'priority.investments.timeline': 'Recommended within 60 days',
    'priority.tax.title': 'Improve Tax Diversification',
    'priority.tax.why':
      'Limited account-type diversity can reduce withdrawal flexibility later.',
    'priority.tax.impact': 'Supports more efficient lifetime tax management in retirement.',
    'priority.tax.timeline': 'Recommended within 60–90 days',
    'priority.healthcare.title': 'Prepare Healthcare & Long-Term Care',
    'priority.healthcare.why':
      'Healthcare or LTC planning gaps can create large unexpected retirement costs.',
    'priority.healthcare.impact': 'Protects nest egg from medical and care-cost shocks.',
    'priority.healthcare.timeline': 'Recommended within 60–90 days',
    'priority.estate.title': 'Complete Estate & Beneficiary Planning',
    'priority.estate.why':
      'Missing documents or outdated beneficiaries can disrupt family and legacy goals.',
    'priority.estate.impact': 'Ensures assets transfer according to your wishes.',
    'priority.estate.timeline': 'Recommended within 60–90 days',
    'priority.whyScore': '({title} score: {score}/100).',
    'level.critical': 'Critical',
    'level.important': 'Important',
    'level.longTerm': 'Long-Term',
    'readiness.strong': 'Strong Retirement Foundation',
    'readiness.onTrack': 'Generally On Track',
    'readiness.gaps': 'Important Gaps to Address',
    'readiness.risks': 'Significant Retirement Risks',
    'readiness.immediate': 'Immediate Planning Priorities',
    'narrative.high':
      '{prefix} retirement profile shows strong fundamentals with targeted opportunities to refine income design and longevity planning.',
    'narrative.mid':
      '{prefix} retirement foundation is workable, but several categories need attention before income is fully sustainable.',
    'narrative.low':
      '{prefix} retirement profile shows meaningful readiness gaps that should be addressed promptly.',
    'narrative.prefixNamed': '{name}, your',
    'narrative.prefixGeneric': 'Your',
    'narrative.gap':
      'An estimated {gap} annual income gap remains under current assumptions.',
    'narrative.noGap': 'Projected income currently covers your modeled spending target.',
    'narrative.retired':
      'Because you are already retired, this report emphasizes sustainability, withdrawals, healthcare, taxes, and legacy.',
    'narrative.disclaimer':
      'These results are educational and do not guarantee retirement outcomes.',
    'blueprint.vision': 'Clarify your retirement vision and timeline',
    'blueprint.savings': 'Accelerate retirement savings and contributions',
    'blueprint.income-sources': 'Strengthen reliable retirement income sources',
    'blueprint.income-adequacy': 'Close your retirement income gap',
    'blueprint.investments': 'Align investment risk and diversification',
    'blueprint.tax': 'Improve tax diversification and efficiency',
    'blueprint.healthcare': 'Prepare for healthcare and long-term care costs',
    'blueprint.estate': 'Complete estate, beneficiary, and legacy planning',
    'blueprint.lifetimeIncome': 'Build a sustainable lifetime income plan',
    'action.retiredWithdrawal':
      'Review withdrawal sustainability against longevity age {longevityAge}.',
    'action.retiredSpendingCheck':
      'Confirm current monthly spending against guaranteed and portfolio income.',
    'action.retiredDocument':
      'Document healthcare, tax, and legacy priorities for the next 90 days.',
    'action.workingHighestRisk': 'Address your highest-risk retirement category.',
    'action.workingContribution': 'Confirm contribution automation and employer match.',
    'action.workingGap': 'Quantify and begin closing the {gap} annual income gap.',
    'action.workingValidate':
      'Validate that projected income still covers your retirement spending target.',
    'action.meetStrategist':
      'Meet with a Valtoris Financial Strategist to review your Retirement Report Card™',
    'action.savingsIncomeList': 'Build a written 12-month savings and income action list.',
    'action.taxSequencing': 'Review tax-efficient withdrawal sequencing.',
    'action.reviewAllocation': 'Review investment allocation against your timeline.',
    'action.taxDiversification': 'Improve tax diversification across account types.',
    'action.healthcareDocs': 'Document Medicare and long-term-care funding plans.',
    'action.estateUpdate': 'Update estate documents and beneficiaries.',
    'status.strength': 'Strength',
    'status.opportunity': 'Opportunity',
    'status.neutral': 'Neutral',
    'status.strong': 'Strong',
    'status.stable': 'Stable',
    'status.needsAttention': 'Needs Attention',
    'status.priorityRisk': 'Priority Risk',
    'chrome.currentScore': 'Current Score',
    'chrome.letterGrade': 'Letter Grade',
    'chrome.atAGlance': 'At a Glance',
    'chrome.insightsTitle': 'Strengths & Opportunities',
    'chrome.insightsLead':
      'Where your retirement plan is strongest today and where the highest-impact improvements live.',
    'chrome.greatestStrengths': 'Greatest Strengths',
    'chrome.biggestOpportunities': 'Biggest Opportunities',
    'chrome.immediate': 'Immediate',
    'chrome.thirtyDays': '30 Days',
    'chrome.ninetyDays': '90 Days',
    'chrome.whyThisMatters': 'Why this matters',
    'chrome.recommendedTimeline': 'Recommended timeline',
    'chrome.priorityRank': 'Priority #{rank}',
    'hero.retirementStatusLabel': 'Retirement Status',
    'hero.targetAgeLabel': 'Target Retirement Age',
    'hero.alreadyRetired': 'Already Retired',
    'hero.retiredCopy':
      'Analysis emphasizes sustainability, withdrawals, healthcare, taxes, and legacy.',
    'hero.yearsCopy': 'About {years} {yearWord} until your stated retirement age.',
    'hero.strongestLabel': 'Strongest Category',
    'hero.priorityLabel': 'Priority Category',
    'hero.categoryScoreCopy': 'Score {score}/100 ({grade}).',
    'hero.gapLabel': 'Estimated Monthly Income Gap',
    'hero.gapCopy':
      'Need {need} · Funded ratio about {fundedRatio}% · Savings rate about {savingsRate}%.',
    'fallback.strength': 'Assessment completed',
    'fallback.opportunity': 'Continue refining your retirement income plan',
    'snapshot.title': 'Your Retirement Snapshot',
    'snapshot.lead':
      'Your Retirement Snapshot highlights monthly need, total projected income, and any estimated gap first. Supporting metrics below include assets, income sources, and category context. Guaranteed income is weighted more heavily than other or temporary sources.',
    'snapshot.highlightsLabel': 'Primary retirement summary',
    'snapshot.needLabel': 'Estimated Monthly Retirement Need',
    'snapshot.incomeLabel': 'Estimated Total Monthly Income',
    'snapshot.gapLabel': 'Estimated Monthly Income Gap',
    'snapshot.assetsLabel': 'Current Retirement Assets',
    'snapshot.projectedAssetsLabel': 'Projected Assets at Retirement',
    'snapshot.guaranteedLabel': 'Guaranteed Monthly Income',
    'snapshot.otherIncomeLabel': 'Other Expected Monthly Income',
    'snapshot.partTimeNote': ' (includes temporary part-time: {amount} for ~{years} yr)',
    'snapshot.portfolioLabel': 'Estimated Portfolio Monthly Income',
    'snapshot.fundedRatioLabel': 'Funded Ratio',
    'snapshot.savingsRateLabel': 'Current Savings Rate',
    'snapshot.yearsLabel': 'Years Until Retirement',
    'snapshot.statusLabel': 'Retirement Status',
    'snapshot.alreadyRetired': 'Already Retired',
    'snapshot.categoriesLabel': 'Strongest / Priority Categories',
    'snapshot.note':
      'These results are educational estimates and do not guarantee retirement outcomes. Assumptions include inflation, growth, withdrawal rate, and longevity age {longevityAge}.',
    'assumption.inflation': 'Inflation',
    'assumption.preRetirementGrowth': 'Pre-retirement growth',
    'assumption.retirementReturn': 'Retirement return',
    'assumption.withdrawalRate': 'Withdrawal rate',
    'assumption.longevityAge': 'Longevity age',
    'pathways.title': 'Potential Planning Pathways',
    'pathways.lead':
      'Educational topics you may explore with a strategist. This list is not a product recommendation.',
    'pathways.1': 'Retirement-income planning',
    'pathways.2': 'Social Security review',
    'pathways.3': 'Pension analysis',
    'pathways.4': '401(k), 403(b), IRA, or TSP rollover review',
    'pathways.5': 'Lifetime-income and annuity analysis',
    'pathways.6': 'Roth and tax-diversification planning',
    'pathways.7': 'Medicare and long-term-care planning',
    'pathways.8': 'Life-insurance review',
    'pathways.9': 'Estate and beneficiary review',
  },
}

const RETIREMENT_COPY_ES: SpecializedCopyCatalog = {
  questions: {},
  helpers: {
    welcome:
      'Responda un conjunto enfocado de preguntas sobre su plazo, ahorros, fuentes de ingreso, inversiones, impuestos, salud y planificación de legado. La mayoría de las personas termina en unos 4 a 6 minutos.',
    welcomeNote:
      'Los resultados son estimaciones educativas basadas en la información que usted proporciona y en supuestos estándar de planificación. No garantizan resultados de retiro.',
    step2:
      'Cuéntenos sobre su hogar y cuándo planea retirarse para poder personalizar sus proyecciones.',
    step3:
      'Comparta su ingreso actual y su gasto estimado en el retiro para poder modelar la suficiencia de ingresos.',
    step4: 'Cuéntenos sobre sus saldos actuales de retiro y sus hábitos de aportación.',
    step5:
      'Estime el ingreso mensual que espera en el retiro (en dólares de hoy). Las fuentes garantizadas tienen más peso que otros ingresos o los ingresos temporales.',
    step6:
      'Revise los supuestos de proyección predeterminados que se usan en su reporte y luego seleccione sus prioridades principales de retiro.',
    step7:
      'Comparta cómo invierte hoy y cómo están estructuradas sus cuentas para tener flexibilidad fiscal.',
    step8:
      'Revise su preparación en temas de salud y los documentos que protegen a su familia y sus metas de legado.',
    step9:
      'Indíquenos cómo comunicarnos con usted y luego vea su Retirement Report Card™ personalizado.',
    alreadyRetiredNote:
      'Como indicó que ya está retirado(a), nos enfocaremos en la sostenibilidad, los retiros de fondos, la salud, los impuestos y el legado, en lugar de una fecha futura de inicio.',
    spendingFallback:
      'Opcional. Si lo deja en blanco, estimamos el gasto de retiro como el 80 % de su ingreso bruto anual actual (convertido a un monto mensual). Puede ajustarlo más adelante.',
    guaranteedIncome:
      'Ingresos del Seguro Social, de pensión y de anualidades que se espera que continúen de por vida (o durante un periodo contractual largo).',
    otherIncome:
      'Ingresos recurrentes que pueden apoyar el retiro, pero que en general son menos garantizados que los pagos del Seguro Social, de pensión o de anualidades.',
    partTimeIncome:
      'El ingreso de medio tiempo o de consultoría se considera temporal y no se cuenta como cobertura garantizada de por vida al estimar el capital necesario.',
    assumptions:
      'Estos supuestos producen estimaciones educativas hipotéticas. Los rendimientos reales del mercado, la inflación, la longevidad y sus circunstancias personales serán distintos. Los resultados no garantizan resultados de retiro. La versión uno no modela en detalle el crecimiento por COLA de cada fuente de ingreso.',
  },
  fields: {
    state: 'Estado',
    maritalStatus: 'Estado civil',
    alreadyRetired: '¿Ya está retirado(a)?',
    currentAge: 'Edad actual',
    targetRetirementAge: 'Edad meta de retiro',
    spouseAge: 'Edad del cónyuge (opcional)',
    spouseTargetRetirementAge: 'Edad meta de retiro del cónyuge (opcional)',
    retirementLifestyle: '¿Qué estilo de vida está planeando para el retiro?',
    planClarity: '¿Qué tan claro es su plan de retiro hoy?',
    primaryMotivation: '¿Cuál es su motivación principal para el retiro?',
    currentAnnualGrossIncome: 'Ingreso bruto anual actual del hogar',
    estimatedMonthlyRetirementSpending: 'Gasto mensual estimado en el retiro',
    debtBurden: '¿Cómo describiría su carga actual de deuda de consumo?',
    currentRetirementSavings: 'Ahorros actuales para el retiro (todas las cuentas)',
    monthlyContribution: 'Aportación mensual para el retiro',
    employerMatch: '¿Recibe aportación equivalente de su empleador para el retiro?',
    contributionConsistency: '¿Con qué constancia aporta?',
    socialSecurityMonthly: 'Seguro Social mensual estimado',
    spouseSocialSecurityMonthly: 'Seguro Social mensual estimado del cónyuge (opcional)',
    pensionMonthly: 'Pensión mensual estimada',
    annuityMonthly: 'Ingreso mensual estimado de anualidades',
    socialSecurityEstimateReviewed:
      '¿Ha revisado una estimación oficial del Seguro Social?',
    pensionElectionUnderstood: '¿Entiende las opciones de elección de su pensión?',
    survivorContinuation:
      '¿Tiene o planea tener cobertura de continuación para el sobreviviente?',
    rentalIncomeMonthly: 'Ingreso mensual estimado por renta de propiedades',
    businessIncomeMonthly: 'Ingreso mensual estimado de negocio',
    otherRecurringIncomeMonthly: 'Otro ingreso mensual recurrente',
    expectsPartTimeWork:
      '¿Espera tener ingresos temporales de medio tiempo o de consultoría en el retiro?',
    estimatedMonthlyPartTimeIncome: 'Ingreso mensual estimado de medio tiempo',
    expectedPartTimeWorkYears: 'Años esperados de trabajo de medio tiempo',
    inflationAwareness:
      '¿Ha revisado cómo la inflación podría afectar su ingreso de retiro?',
    goals: '¿Cuáles son sus prioridades principales de retiro? (Seleccione hasta 3)',
    riskTolerance: '¿Cómo describiría su tolerancia al riesgo de inversión?',
    diversification: '¿Qué tan diversificadas están sus inversiones de retiro?',
    allocationReview: '¿Cuándo revisó formalmente su distribución de inversiones por última vez?',
    accountTypes: '¿Qué tipos de cuentas de retiro usa actualmente?',
    taxPlanning: '¿Cómo describiría su planificación fiscal para el retiro?',
    rothUsage: '¿Con qué frecuencia usa aportaciones o conversiones Roth?',
    medicareReadiness: '¿Qué tan preparado(a) está para la inscripción y planificación de Medicare?',
    longTermCarePlan: '¿Cómo planea financiar los cuidados de largo plazo?',
    hsaBalance: 'Saldo actual de la HSA',
    hasWill: '¿Tiene testamento?',
    hasTrust: '¿Tiene fideicomiso?',
    beneficiariesReviewed:
      '¿Ha revisado a los beneficiarios de sus cuentas principales en los últimos 2 o 3 años?',
    hasPowerOfAttorney: '¿Tiene un poder notarial duradero?',
    legacyIntent: '¿Cómo describiría su intención de legado o herencia?',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    preferredContactMethod: 'Método de contacto preferido',
    bestContactTime: 'Mejor horario para contactarle',
    primaryConcern: 'Principal preocupación sobre el retiro (opcional)',
    consent: 'Consentimiento',
    guaranteedIncomeHeading: 'Ingreso garantizado',
    otherIncomeHeading: 'Otros ingresos esperados',
    partTimeIncomeHeading: 'Ingreso temporal o de medio tiempo',
    assumptionsHeading: 'Supuestos de proyección predeterminados',
    investmentsHeading: 'Riesgo de inversión y diversificación',
    taxHeading: 'Diversificación y eficiencia fiscal',
    healthcareHeading: 'Salud y cuidados de largo plazo',
    estateHeading: 'Patrimonio, beneficiarios y legado',
  },
  answers: {
    yes: 'Sí',
    no: 'No',
    'maritalStatus.single': 'Soltero(a)',
    'maritalStatus.married': 'Casado(a)',
    'maritalStatus.divorced': 'Divorciado(a)',
    'maritalStatus.widowed': 'Viudo(a)',
    'maritalStatus.domestic-partnership': 'Unión doméstica',
    'alreadyRetired.yes': 'Sí — ya estoy retirado(a)',
    'alreadyRetired.no': 'No — todavía estoy trabajando hacia el retiro',
    'retirementLifestyle.essential': 'Esencial / enfocado en lo necesario',
    'retirementLifestyle.comfortable': 'Cómodo',
    'retirementLifestyle.affluent': 'Acomodado',
    'retirementLifestyle.luxury': 'De lujo / estilo de vida soñado',
    'planClarity.very-clear': 'Plan escrito muy claro',
    'planClarity.somewhat-clear': 'Dirección algo clara',
    'planClarity.unclear': 'Poco claro / todavía lo estoy definiendo',
    'planClarity.no-plan': 'Aún no tengo plan',
    'primaryMotivation.income-security': 'Asegurar ingresos de por vida',
    'primaryMotivation.leave-workforce': 'Dejar de trabajar en mis propios términos',
    'primaryMotivation.travel-lifestyle': 'Viajar y tener libertad de estilo de vida',
    'primaryMotivation.family-legacy': 'Apoyar a mi familia y dejar un legado',
    'primaryMotivation.reduce-stress': 'Reducir el estrés financiero',
    'debtBurden.none': 'Sin deuda de consumo significativa',
    'debtBurden.low': 'Baja — pagos manejables',
    'debtBurden.moderate': 'Moderada — limita mi flexibilidad',
    'debtBurden.high': 'Alta — genera presión',
    'employerMatch.full-match': 'Sí — aprovecho la aportación completa',
    'employerMatch.partial-match': 'Sí — pero no aprovecho la aportación completa',
    'employerMatch.no-match-offered': 'Mi empleador no ofrece aportación equivalente',
    'employerMatch.not-participating': 'Hay aportación disponible, pero no participo',
    'employerMatch.self-employed': 'Trabajo por cuenta propia / sin plan del empleador',
    'employerMatch.unsure': 'No estoy seguro(a)',
    'contributionConsistency.always': 'En cada cheque de pago / siempre',
    'contributionConsistency.most-months': 'La mayoría de los meses',
    'contributionConsistency.sometimes': 'A veces',
    'contributionConsistency.rarely': 'Rara vez',
    'contributionConsistency.not-saving': 'Actualmente no estoy aportando',
    'yesNoUnsure.yes': 'Sí',
    'yesNoUnsure.no': 'No',
    'yesNoUnsure.unsure': 'No estoy seguro(a)',
    'yesNoNaUnsure.yes': 'Sí',
    'yesNoNaUnsure.no': 'No',
    'yesNoNaUnsure.na': 'No aplica',
    'yesNoNaUnsure.unsure': 'No estoy seguro(a)',
    'expectsPartTime.yes':
      'Sí — espero ingresos temporales de medio tiempo o de consultoría',
    'expectsPartTime.no': 'No',
    'riskTolerance.conservative': 'Conservador',
    'riskTolerance.moderate': 'Moderado',
    'riskTolerance.growth': 'Orientado al crecimiento',
    'riskTolerance.aggressive': 'Agresivo',
    'riskTolerance.unsure': 'No estoy seguro(a)',
    'diversification.well-diversified': 'Bien diversificadas entre clases de activos',
    'diversification.somewhat': 'Algo diversificadas',
    'diversification.concentrated': 'Concentradas en unas pocas posiciones',
    'diversification.unsure': 'No estoy seguro(a)',
    'allocationReview.within-year': 'Revisada en el último año',
    'allocationReview.1-3-years': 'Hace 1 a 3 años',
    'allocationReview.over-3-years': 'Hace más de 3 años',
    'allocationReview.never': 'Nunca la he revisado formalmente',
    'allocationReview.unsure': 'No estoy seguro(a)',
    'accountTypes.traditional': '401(k) tradicional / IRA',
    'accountTypes.roth': 'Roth 401(k) / Roth IRA',
    'accountTypes.taxable': 'Cuenta de inversión gravable',
    'accountTypes.hsa': 'HSA',
    'accountTypes.pension': 'Pensión / beneficio definido',
    'accountTypes.annuity': 'Anualidad',
    'accountTypes.none': 'Todavía no tengo cuentas de retiro',
    'taxPlanning.proactive': 'Planificación fiscal proactiva de varios años',
    'taxPlanning.annual-review': 'Revisión anual con planificación limitada',
    'taxPlanning.compliance-only': 'Solo declaro y pago',
    'taxPlanning.none': 'Sin planificación fiscal para el retiro',
    'rothUsage.regular': 'Aportaciones o conversiones Roth de forma regular',
    'rothUsage.some': 'Algún saldo Roth, con aportaciones poco frecuentes',
    'rothUsage.none': 'Sin activos Roth',
    'rothUsage.unsure': 'No estoy seguro(a)',
    'medicareReadiness.researched': 'Investigado / plan de inscripción listo',
    'medicareReadiness.somewhat': 'Algo familiarizado(a)',
    'medicareReadiness.not-yet': 'Todavía no lo he explorado',
    'medicareReadiness.already-enrolled': 'Ya estoy inscrito(a) en Medicare',
    'medicareReadiness.years-away': 'Faltan años — todavía no aplica',
    'longTermCarePlan.has-coverage': 'Tengo seguro de cuidados de largo plazo o un plan financiado',
    'longTermCarePlan.self-fund': 'Planeo pagarlo con mis propios activos',
    'longTermCarePlan.family-support': 'Espero apoyo de la familia',
    'longTermCarePlan.no-plan': 'Aún no tengo plan',
    'longTermCarePlan.unsure': 'No estoy seguro(a)',
    'legacyIntent.strong': 'Metas firmes de legado o herencia',
    'legacyIntent.moderate': 'Moderada — dejar algo si es posible',
    'legacyIntent.spend-down': 'Prefiero usar mis activos durante mi vida',
    'legacyIntent.unsure': 'No estoy seguro(a)',
    'goals.close-income-gap': 'Cerrar mi brecha de ingresos de retiro',
    'goals.increase-savings': 'Aumentar mi tasa de ahorro',
    'goals.diversify-taxes': 'Mejorar la diversificación fiscal',
    'goals.reduce-investment-risk': 'Alinear el riesgo de inversión',
    'goals.plan-healthcare': 'Planificar salud y cuidados de largo plazo',
    'goals.protect-legacy': 'Proteger a los beneficiarios y el legado',
    'goals.clarify-timeline': 'Aclarar mi plazo de retiro',
    'goals.maximize-income-sources': 'Maximizar mis fuentes de ingreso',
    'contactMethod.email': 'Correo electrónico',
    'contactMethod.phone': 'Llamada telefónica',
    'contactMethod.text': 'Mensaje de texto',
    'contactMethod.either': 'Correo o teléfono — el que sea más conveniente',
    'contactTime.morning': 'Mañana (8am–12pm)',
    'contactTime.afternoon': 'Tarde (12pm–5pm)',
    'contactTime.evening': 'Noche (5pm–8pm)',
    'contactTime.anytime': 'Cualquier hora',
  },
  placeholders: {
    currentAge: '55',
    targetRetirementAge: '65',
    spouseAge: '53',
    spouseTargetRetirementAge: '65',
    income: '150,000',
    spending: '6,500',
    savings: '320,000',
    contribution: '900',
    socialSecurity: '2,300',
    spouseSocialSecurity: '1,500',
    zero: '0',
    partTimeIncome: '800',
    partTimeYears: '3',
    hsa: '8,000',
    firstName: 'Escriba su nombre',
    lastName: 'Escriba su apellido',
    email: 'usted@correo.com',
    phone: '(555) 555-5555',
    primaryConcern: 'p. ej., cerrar mi brecha de ingresos',
  },
  validation: {
    consentRequired: 'Confirme los reconocimientos obligatorios antes de continuar.',
    submitFailed: 'No pudimos guardar su Retirement Report Card™. Inténtelo de nuevo.',
    retry: 'Intentar de nuevo',
    ingestUnavailable:
      'Sus respuestas se revisaron en este dispositivo. No se enviaron al CRM de Valtoris.',
    ageOrder: 'La edad meta de retiro debe ser mayor o igual que su edad actual.',
    contactConsent:
      'Entiendo que estos resultados son estimaciones educativas para fines de planificación y que no garantizan resultados de retiro. Valtoris puede comunicarse conmigo sobre mi Retirement Report Card™ usando las preferencias que indiqué.',
  },
  ui: {
    welcomeTitle: 'Comience su Retirement Report Card™',
    startCta: 'Obtener mi puntuación de retiro',
    backToOverview: 'Volver al resumen',
    back: 'Atrás',
    continue: 'Continuar',
    viewResults: 'Ver mi Retirement Report Card',
    saving: 'Guardando su Retirement Report Card…',
    stepIndicator: 'Paso {current} de {total}',
    languageGroupLabel: 'Idioma',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    consentHeading: 'Reconocimientos',
    consentIntro:
      'Su Retirement Report Card™ se basa en la información que compartió. Los reconocimientos obligatorios están marcados con un asterisco.',
    consentStorage:
      'Entiendo que Valtoris usará la información que proporciono para calcular y guardar mi {storageResultName} y los resultados relacionados.',
    consentStorageHint: 'Reconocimiento obligatorio para guardar y calcular su reporte.',
    consentStorageError:
      'Confirme que su información se usará para calcular y guardar su reporte.',
    consentContact:
      'Doy permiso a Valtoris para comunicarse conmigo sobre mis resultados y los posibles pasos siguientes.',
    consentEmailMarketing:
      'Acepto recibir correos electrónicos promocionales ocasionales de Valtoris. Puedo cancelar la suscripción en cualquier momento.',
    consentSms:
      'Acepto recibir mensajes de texto promocionales recurrentes de Valtoris al número indicado. Este consentimiento no es requisito para recibir mi reporte. Pueden aplicar tarifas de mensajes y datos. Responda STOP para darse de baja.',
    consentSmsPhoneNote:
      'Agregue un número de teléfono antes en la evaluación para habilitar esta opción.',
    consentPrivacyBefore: 'Confirmo que he revisado la',
    consentPrivacyLink: 'Política de privacidad de Valtoris',
    consentPrivacyAfter: '.',
    consentPrivacyHint:
      'Reconocimiento de privacidad obligatorio. Abre la Política de privacidad en una pestaña nueva.',
    consentPrivacyError: 'Revise y confirme la Política de privacidad antes de continuar.',
    consentDisclaimer:
      'Los resultados son estimaciones educativas basadas en la información que usted reporta y en supuestos estándar de planificación. No son asesoría financiera, legal, fiscal, de inversiones, de crédito ni de seguros, y no garantizan resultados de retiro. La revisión de un asesor puede llegar a conclusiones distintas.',
    consentHoneypot: 'Sitio web de la empresa',
    productTitle: 'Retirement Report Card™',
    storageResultName: 'Retirement Report Card',
    step2Title: 'Hogar y plazo de retiro',
    step3Title: 'Ingresos y gasto en el retiro',
    step4Title: 'Ahorros para el retiro',
    step5Title: 'Fuentes de ingreso en el retiro',
    step6Title: 'Sostenibilidad del ingreso',
    step7Title: 'Inversiones e impuestos',
    step8Title: 'Salud, protección y legado',
    step9Title: 'Contacto y resultados',
    landingEyebrow: 'VALTORIS RETIREMENT REPORT CARD™',
    landingTitle: '¿Está en camino de retirarse con confianza?',
    landingHero1:
      'Complete el Valtoris Retirement Report Card™ para evaluar su ingreso de retiro, su avance en ahorros, el Seguro Social, las decisiones de pensión, el riesgo de inversión, la diversificación fiscal, la preparación en temas de salud y la planificación de su legado.',
    landingHero2:
      'Vea qué parece estar en camino, dónde podrían existir brechas importantes y qué atender después.',
    landingMicrocopy:
      'Toma unos 4 a 6 minutos. Sin costo. Sin compromiso. Los resultados son estimaciones, no garantías.',
    landingReceiveHeading: 'Qué recibirá',
    landingReceiveLead:
      'Cuatro entregables diseñados para convertir una evaluación breve en una dirección de retiro más clara.',
    landingReceive1Title: 'Puntuación de preparación para el retiro',
    landingReceive1Description:
      'Una puntuación general y una calificación con letra que resumen qué tan preparado parece su plan hoy.',
    landingReceive2Title: 'Análisis de la brecha de ingresos',
    landingReceive2Description:
      'Una vista clara del gasto proyectado en el retiro frente a las fuentes de ingreso esperadas.',
    landingReceive3Title: 'Revisión categoría por categoría',
    landingReceive3Description:
      'Ocho categorías de retiro con puntuación para que vea fortalezas y brechas una al lado de la otra.',
    landingReceive4Title: 'Plan de acción personalizado',
    landingReceive4Description:
      'Prioridades inmediatas, a 30 días y a 90 días, adaptadas a sus respuestas y a su plazo.',
    landingSampleHeading: 'Vista previa de un reporte de ejemplo',
    landingSampleLead:
      'Una muestra ilustrativa de la puntuación, el detalle por categoría y el plan de acción que puede esperar.',
    landingSampleBadge: 'Vista previa de ejemplo',
    landingSampleAriaLabel: 'Vista previa de ejemplo del Retirement Report Card™',
    landingSampleScore: 'Puntuación general',
    landingSampleGrade: 'Calificación',
    landingSampleReadiness: 'Brechas importantes por atender',
    landingSampleStrongest: 'Área más fuerte',
    landingSamplePriority: 'Área prioritaria',
    landingSampleRetirementAge: 'Edad de retiro',
    landingSampleMonthlyNeed: 'Necesidad mensual proyectada',
    landingSampleMonthlyIncome: 'Ingreso mensual estimado',
    landingSampleMonthlyGap: 'Brecha mensual estimada',
    landingSampleFundedRatio: 'Razón de financiamiento',
    landingSampleBarsLabel: 'Puntuaciones de ejemplo por categoría de retiro',
    landingSampleBarSavings: 'Avance en ahorros',
    landingSampleBarIncomeSources: 'Fuentes de ingreso',
    landingSampleBarSustainability: 'Sostenibilidad del ingreso',
    landingSampleBarInvestments: 'Inversiones',
    landingSampleImmediate: 'Prioridades inmediatas',
    landingSample30: 'Plan de acción a 30 días',
    landingSample90: 'Plan de acción a 90 días',
    landingSampleImmediate1: 'Confirmar las estimaciones del Seguro Social',
    landingSampleImmediate2: 'Revisar la brecha proyectada de ingresos de retiro',
    landingSample30_1: 'Aumentar las aportaciones un 2 %',
    landingSample30_2: 'Consolidar la información de las cuentas de retiro',
    landingSample30_3: 'Revisar el riesgo de inversión',
    landingSample90_1: 'Crear una estrategia escrita de ingresos de retiro',
    landingSample90_2: 'Evaluar oportunidades de diversificación fiscal',
    landingSample90_3: 'Completar la revisión de salud y de planificación patrimonial',
    landingSampleDisclaimer:
      'Solo es un ejemplo ilustrativo. Sus resultados personalizados reflejarán sus respuestas. Estas estimaciones no garantizan resultados de retiro.',
    landingCategoriesHeading: 'Ocho categorías de retiro',
    landingCategoriesLead:
      'Su Report Card revisa las ocho áreas que forman una base de retiro coordinada.',
    landingCategory1Title: 'Visión y plazo de retiro',
    landingCategory1Description:
      'Aclare sus metas de estilo de vida, la claridad de su plan y la fecha en que desea retirarse.',
    landingCategory2Title: 'Avance en ahorros y aportaciones',
    landingCategory2Description:
      'Evalúe sus saldos, sus hábitos de aportación y el uso de la aportación del empleador.',
    landingCategory3Title: 'Fuentes de ingreso en el retiro',
    landingCategory3Description:
      'Revise el Seguro Social, la pensión, las anualidades y otras fuentes de ingreso esperadas.',
    landingCategory4Title: 'Suficiencia y sostenibilidad del ingreso',
    landingCategory4Description:
      'Compare el ingreso proyectado con su necesidad de gasto según supuestos estándar de planificación.',
    landingCategory5Title: 'Riesgo de inversión y diversificación',
    landingCategory5Description:
      'Evalúe su postura de riesgo, su diversificación y sus hábitos de revisión de la distribución.',
    landingCategory6Title: 'Diversificación y eficiencia fiscal',
    landingCategory6Description:
      'Revise los tipos de cuenta, el uso de Roth y su preparación en planificación fiscal.',
    landingCategory7Title: 'Preparación para salud y cuidados de largo plazo',
    landingCategory7Description:
      'Verifique su preparación para Medicare, los saldos de la HSA y su plan de cuidados de largo plazo.',
    landingCategory8Title: 'Patrimonio, beneficiarios y legado',
    landingCategory8Description:
      'Revise testamentos, fideicomisos, poderes notariales, beneficiarios e intención de legado.',
    landingHowHeading: 'Cómo funciona',
    landingHowLead:
      'De sus primeras respuestas a un siguiente paso más claro, en cuatro etapas enfocadas.',
    landingHow1Title: 'Responda las preguntas',
    landingHow1Description:
      'Comparta detalles enfocados sobre su plazo, sus ahorros, sus ingresos y su protección.',
    landingHow2Title: 'Reciba sus resultados',
    landingHow2Description:
      'Obtenga su puntuación de retiro, su calificación y el desglose por categoría de inmediato.',
    landingHow3Title: 'Revise su plan',
    landingHow3Description:
      'Vea qué parece estar en camino, dónde podrían existir brechas y qué priorizar después.',
    landingHow4Title: 'Agende una sesión de estrategia',
    landingHow4Description:
      'De forma opcional, revise sus resultados en una conversación de estrategia sin costo.',
    landingFaqHeading: 'Preguntas frecuentes',
    landingFaqLead: 'Respuestas claras antes de comenzar.',
    landingFaq1: '¿Cuánto tiempo toma el Retirement Report Card™?',
    landingFaqA1:
      'La mayoría de las personas termina en unos 4 a 6 minutos. No necesita crear una cuenta.',
    landingFaq2: '¿Es gratis?',
    landingFaqA2: 'Sí. El Valtoris Retirement Report Card™ es sin costo y sin compromiso.',
    landingFaq3: '¿Las proyecciones están garantizadas?',
    landingFaqA3:
      'No. Los resultados son estimaciones educativas basadas en sus respuestas y en supuestos estándar de planificación. No garantizan resultados de retiro.',
    landingFaq4: '¿Necesito los saldos exactos de mis cuentas?',
    landingFaqA4:
      'Las cifras aproximadas son suficientes. Datos más precisos producen estimaciones más útiles, pero puede ajustar los detalles más adelante.',
    landingFaq5: '¿Tengo que comprar algo?',
    landingFaqA5: 'No. Usted recibe sus resultados, decida o no dar un paso siguiente.',
    landingFaq6: '¿Alguien se comunicará conmigo?',
    landingFaqA6:
      'Solo si usted indica sus preferencias de contacto y da su consentimiento. Completar el reporte por sí solo no crea ningún compromiso de compra.',
    landingFaq7: '¿Puedo repetirlo más adelante?',
    landingFaqA7: 'Sí. Puede repetir la evaluación cuando cambie su situación.',
    landingClosingTitle: '¿Listo para ver dónde está su retiro?',
    landingClosingCopy:
      'Dé el primer paso y reciba una imagen más clara de su puntuación, su brecha de ingresos y sus próximas prioridades.',
    landingClosingMicrocopy:
      'Toma unos 4 a 6 minutos. Sin costo. Sin compromiso. Los resultados son estimaciones, no garantías.',
    resultsDiagnosticLabel:
      'Retirement Report Card™ · Diagnóstico de preparación para el retiro',
    resultsDisclaimer:
      'Estos resultados son estimaciones educativas basadas en la información que usted reporta y en supuestos estándar de planificación. No son asesoría financiera, legal, fiscal, de inversiones, de crédito ni de seguros, y no garantizan resultados de retiro. La revisión de un asesor puede llegar a conclusiones distintas.',
    resultsScheduleTitle: 'Agende su sesión de estrategia sin costo™',
    resultsScheduleCopy:
      'Revise su Retirement Report Card™ con un estratega de Valtoris y reciba un plan de acción personalizado para fortalecer su preparación de ingresos para el retiro.',
    resultsRetake: 'Repetir la evaluación',
    preparedFor: 'Preparado para {name}',
    sampleGreeting: 'Retirement Report Card™ de ejemplo',
  },
  results: {
    title: 'Retirement Report Card™',
    scoreLabel: 'Puntuación de preparación para el retiro™',
    glanceLead: 'Su preparación para el retiro en ocho categorías de planificación.',
    prioritiesTitle: 'Las 3 prioridades principales de retiro™',
    prioritiesLead:
      'Los siguientes pasos de mayor impacto según sus respuestas y las métricas de proyección.',
    impactLabel: 'Impacto en el retiro',
    actionPlanTitle: 'Plan de acción para el retiro™',
    actionPlanLead:
      'Prioridades inmediatas, a 30 días y a 90 días, adaptadas a su perfil.',
    categoriesTitle: 'Detalle por categoría',
    categoriesLead:
      'Expanda cada categoría para ver su estado, orientación y próximos pasos recomendados. Las etiquetas de estado son indicadores educativos de preparación, no garantías.',
    blueprintTitle: 'Plan maestro de retiro™',
    blueprintCopyNamed:
      'Este reporte ayuda a {name} a identificar qué parece estar en camino, dónde podrían existir brechas y qué atender después, con estimaciones educativas, no garantías.',
    blueprintCopyGeneric:
      'Este reporte ayuda a identificar qué parece estar en camino, dónde podrían existir brechas y qué atender después, con estimaciones educativas, no garantías.',
    statusMetricLabel: 'Preparación',
    recommendationsSubhead: 'Próximos pasos',
    footer1: 'Desarrollado por Valtoris Financial™',
    footer2:
      'Ayudamos a las familias a planificar su ingreso de retiro con claridad™',
    'category.vision': 'Visión y plazo de retiro',
    'category.savings': 'Avance en ahorros y aportaciones',
    'category.income-sources': 'Fuentes de ingreso en el retiro',
    'category.income-adequacy': 'Suficiencia y sostenibilidad del ingreso',
    'category.investments': 'Riesgo de inversión y diversificación',
    'category.tax': 'Diversificación y eficiencia fiscal',
    'category.healthcare': 'Preparación para salud y cuidados de largo plazo',
    'category.estate': 'Patrimonio, beneficiarios y legado',
    'summary.vision.high': 'Su visión y su plazo de retiro parecen claros y accionables.',
    'summary.vision.mid': 'Tiene una dirección, pero la claridad del plazo podría ser mayor.',
    'summary.vision.low':
      'La visión de retiro o la claridad del plazo necesitan atención importante.',
    'summary.savings.high':
      'Los saldos de ahorro y los hábitos de aportación parecen sólidos para su plazo.',
    'summary.savings.mid':
      'Está ahorrando, pero su avance en aportaciones quizá necesite acelerarse.',
    'summary.savings.low':
      'El ahorro y las aportaciones parecen limitados frente a su necesidad de retiro.',
    'summary.income-sources.high':
      'Las fuentes de ingreso confiables parecen bien alineadas con su necesidad de gasto.',
    'summary.income-sources.mid':
      'Existen fuentes de ingreso, pero la cobertura o la confiabilidad pueden mejorar.',
    'summary.income-sources.low':
      'La confiabilidad del ingreso o la cobertura del gasto parece limitada.',
    'summary.income-adequacy.high':
      'El ingreso proyectado de retiro parece suficiente frente a su meta de gasto.',
    'summary.income-adequacy.mid':
      'El ingreso podría cubrir la mayoría de sus necesidades, pero queda una brecha de sostenibilidad.',
    'summary.income-adequacy.low':
      'Una brecha importante de ingresos podría poner en riesgo la sostenibilidad de largo plazo.',
    'summary.investments.high':
      'El riesgo de inversión y la diversificación parecen alineados con su plazo.',
    'summary.investments.mid':
      'La distribución es funcional, pero el riesgo o la frecuencia de revisión podrían necesitar atención.',
    'summary.investments.low':
      'El riesgo de inversión, la concentración o los hábitos de revisión podrían afectar su preparación.',
    'summary.tax.high':
      'La diversidad de tipos de cuenta y sus hábitos de planificación fiscal parecen sólidos.',
    'summary.tax.mid':
      'Existe algo de diversificación fiscal, con espacio para mejorar la eficiencia.',
    'summary.tax.low': 'La diversificación o la planificación fiscal parece limitada.',
    'summary.healthcare.high':
      'La preparación para salud y cuidados de largo plazo parece bien considerada.',
    'summary.healthcare.mid':
      'Hay algo de planificación en temas de salud, pero podrían quedar brechas.',
    'summary.healthcare.low':
      'La planificación de salud o de cuidados de largo plazo necesita atención antes o durante el retiro.',
    'summary.estate.high':
      'Los documentos patrimoniales y la planificación de beneficiarios parecen en buen estado.',
    'summary.estate.mid':
      'Algunos elementos patrimoniales están listos, pero podrían necesitar actualización.',
    'summary.estate.low':
      'Los documentos patrimoniales, los beneficiarios o la intención de legado necesitan atención.',
    'guidance.vision':
      'Una visión clara y un plazo realista guían las decisiones de ahorro, diseño de ingresos y riesgo.',
    'guidance.savings.retired':
      'En el retiro, enfóquese en retiros de fondos sostenibles y en preservar la duración de su portafolio.',
    'guidance.savings.working':
      'Las aportaciones constantes y el aprovechar la aportación del empleador se acumulan hacia una mejor preparación de largo plazo.',
    'guidance.income-sources':
      'El ingreso garantizado (Seguro Social, pensión, anualidad) tiene más peso que el ingreso por rentas, por negocio o el ingreso temporal por trabajo.',
    'guidance.income-adequacy.retired':
      'El análisis para quienes ya están retirados enfatiza la cobertura del gasto actual, la sostenibilidad de los retiros de fondos y la longevidad.',
    'guidance.income-adequacy.working':
      'La suficiencia compara el ingreso de retiro que usted indicó más los retiros del portafolio con la necesidad de gasto ajustada por inflación cuando aún faltan años para el retiro.',
    'guidance.investments.retired':
      'En el retiro, priorice la estrategia de retiros de fondos y el manejo del riesgo de secuencia de rendimientos.',
    'guidance.investments.working':
      'El riesgo debe corresponder a su horizonte de tiempo, y la diversificación debe revisarse con una frecuencia definida.',
    'guidance.tax.retired':
      'En el retiro, un orden de retiros eficiente en impuestos puede extender la duración de su portafolio.',
    'guidance.tax.working':
      'Combinar cuentas antes de impuestos, Roth y gravables mejora su flexibilidad en el retiro.',
    'guidance.healthcare':
      'Los costos de salud y de cuidados de largo plazo están entre las mayores incertidumbres del retiro.',
    'guidance.estate':
      'Documentos claros y beneficiarios actualizados protegen a su familia y sus metas de legado.',
    'rec.vision.high1': 'Revise cada año su visión de retiro por escrito.',
    'rec.vision.high2':
      'Confirme los supuestos de su plazo después de cambios importantes de vida.',
    'rec.vision.low1':
      'Escriba una visión de retiro de una página con una fecha meta y una definición de estilo de vida.',
    'rec.vision.low2':
      'Ponga a prueba su edad de retiro frente a su capacidad de ahorro y de ingresos.',
    'rec.savings.highRetired1': 'Mantenga una política escrita de retiros de fondos.',
    'rec.savings.highRetired2':
      'Revise cada año su gasto frente al ingreso que genera su portafolio.',
    'rec.savings.highWorking1': 'Aumente sus aportaciones con cada aumento o bono.',
    'rec.savings.highWorking2':
      'Siga aprovechando cualquier aportación disponible del empleador.',
    'rec.savings.none1':
      'Abra o financie una cuenta de retiro y automatice una aportación inicial.',
    'rec.savings.none2':
      'Aproveche de inmediato cualquier aportación disponible del empleador.',
    'rec.savings.lowRetired1':
      'Revise su tasa de retiro de fondos frente a una longevidad de {longevityAge} años.',
    'rec.savings.lowRetired2':
      'Identifique gastos discrecionales que puedan ajustarse según el mercado.',
    'rec.savings.lowWorking1':
      'Aumente sus aportaciones mensuales entre 1 % y 2 % de su ingreso.',
    'rec.savings.lowWorking2':
      'Automatice las transferencias el día de pago y revise el uso de la aportación del empleador.',
    'rec.income-sources.high1':
      'Coordine las estrategias de reclamación y de sobreviviente entre quienes generan ingreso en el hogar.',
    'rec.income-sources.high2':
      'Revise la confiabilidad de sus fuentes de ingreso cada 2 o 3 años.',
    'rec.income-sources.low1':
      'Aumente la parte de su gasto de retiro que cubre el ingreso garantizado.',
    'rec.income-sources.low2':
      'Confirme las estimaciones del Seguro Social, las elecciones de pensión, las opciones de sobreviviente y el efecto de la inflación en su ingreso.',
    'rec.income-adequacy.high1':
      'Vuelva a correr las proyecciones después de cambios importantes de ingreso o de gasto.',
    'rec.income-adequacy.high2':
      'Ponga a prueba los supuestos de longevidad y de inflación.',
    'rec.income-adequacy.gap1':
      'Dé prioridad a cerrar la brecha anual estimada de ingresos de {gap}.',
    'rec.income-adequacy.gap2':
      'Combine más ahorro, un retiro más tardío y ajustes de gasto según se necesite.',
    'rec.income-adequacy.ok1':
      'Confirme con un asesor los supuestos de gasto y su tasa de retiro de fondos.',
    'rec.income-adequacy.ok2':
      'Documente un plan sostenible de ingresos de por vida.',
    'rec.investments.high1':
      'Mantenga una política escrita de distribución y rebalancee cada año.',
    'rec.investments.high2':
      'Evite que su portafolio se concentre en unas pocas posiciones.',
    'rec.investments.low1':
      'Revise su distribución de activos frente a los años que le faltan para el retiro.',
    'rec.investments.low2':
      'Diversifique las posiciones concentradas y establezca un calendario de revisión recurrente.',
    'rec.tax.high1': 'Continúe con la gestión Roth y de tramos fiscales de varios años.',
    'rec.tax.high2': 'Coordine sus retiros de fondos entre los distintos tipos de cuenta.',
    'rec.tax.low1':
      'Construya saldos en cuentas tradicionales, Roth y gravables donde sea elegible.',
    'rec.tax.low2':
      'Agregue una revisión anual sencilla de planificación fiscal para sus retiros de fondos.',
    'rec.healthcare.high1':
      'Revise cada pocos años los supuestos de Medicare y de cuidados de largo plazo.',
    'rec.healthcare.high2':
      'Cuando sea posible, reserve los fondos de la HSA para gastos médicos calificados.',
    'rec.healthcare.low1':
      'Documente un plan de transición a Medicare y las primas estimadas.',
    'rec.healthcare.low2':
      'Elija una forma de financiar los cuidados de largo plazo (seguro, fondos propios o mixto).',
    'rec.estate.high1':
      'Revise sus documentos patrimoniales cada 3 a 5 años o después de cambios de vida.',
    'rec.estate.high2':
      'Confirme los beneficiarios contingentes en todas sus cuentas.',
    'rec.estate.low1':
      'Actualice testamentos, poderes notariales y designaciones de beneficiarios.',
    'rec.estate.low2':
      'Documente su intención de legado y alinee la titularidad de sus cuentas.',
    'explanation.vision.retired':
      'Usted indicó que ya está retirado(a). La puntuación enfatiza la claridad de su plan de retiro actual en lugar de una fecha futura de inicio.',
    'explanation.vision.working':
      'Usted reportó retirarse en aproximadamente {years} {yearWord} (de {currentAge} a {retirementAge} años).',
    'explanation.savings':
      'Ahorros actuales para el retiro: {savings}. Aportaciones mensuales: {contribution}.',
    'explanation.income-sources':
      'Ingreso mensual garantizado: {guaranteed} ({coverage} del gasto). Otro ingreso mensual esperado: {other}{partTimeNote}.',
    'explanation.incomeSourcesPartTime': ' (incluye ingreso temporal de medio tiempo)',
    'explanation.income-adequacy':
      'Gasto mensual meta: {target}. Ingreso esperado antes del portafolio: {beforePortfolio}. Ingreso mensual total proyectado: {total}. Brecha anual estimada: {gap}.',
    'explanation.investments':
      'Postura de riesgo reportada: {risk}; diversificación: {diversification}.',
    'explanation.tax': 'Tipos de cuenta seleccionados: {types}.',
    'explanation.healthcare':
      'Preparación para Medicare: {medicare}. Plan de cuidados de largo plazo: {longTermCare}. Saldo de la HSA: {hsa}.',
    'explanation.estate':
      'Testamento: {will}; Fideicomiso: {trust}; Beneficiarios revisados: {beneficiaries}; Poder notarial: {powerOfAttorney}.',
    'year.one': 'año',
    'year.many': 'años',
    unspecified: 'sin especificar',
    notAvailable: 'n/d',
    none: 'ninguno',
    'priority.vision.title': 'Aclare su visión y su plazo de retiro',
    'priority.vision.why':
      'Una visión o un plazo poco claros dificultan coordinar las decisiones de ahorro y de ingresos.',
    'priority.vision.impact':
      'Crea un marco de decisión para su tasa de ahorro, su riesgo y su fecha de retiro.',
    'priority.vision.timeline': 'Se recomienda dentro de 30 días',
    'priority.savings.title': 'Acelere sus ahorros y aportaciones',
    'priority.savings.why':
      'Sus saldos actuales o sus hábitos de aportación podrían no sostener su meta de ingreso en el retiro.',
    'priority.savings.impact':
      'Mejora el capital proyectado y reduce las brechas futuras de ingreso.',
    'priority.savings.timeline': 'Se recomienda dentro de 30 a 60 días',
    'priority.incomeSources.title': 'Fortalezca su ingreso de retiro confiable',
    'priority.incomeSources.why':
      'La cobertura del ingreso garantizado o el entendimiento de sus beneficios podrían dejar expuesto su gasto.',
    'priority.incomeSources.impact':
      'Mejora la confiabilidad de su flujo de efectivo de por vida en el retiro.',
    'priority.incomeSources.timeline': 'Se recomienda dentro de 60 a 90 días',
    'priority.incomeAdequacy.title': 'Cierre su brecha de ingresos de retiro',
    'priority.incomeAdequacy.why':
      'El ingreso proyectado podría quedar por debajo de su necesidad de gasto en el retiro.',
    'priority.incomeAdequacy.impact':
      'Mejora las probabilidades de sostener su estilo de vida hasta una longevidad de {longevityAge} años.',
    'priority.incomeAdequacy.timeline': 'Se recomienda dentro de 30 a 60 días',
    'priority.investments.title': 'Alinee el riesgo de inversión y la diversificación',
    'priority.investments.why':
      'Su postura de riesgo, su concentración o su frecuencia de revisión podrían no corresponder a su plazo.',
    'priority.investments.impact':
      'Reduce el riesgo de secuencia de rendimientos y de concentración cerca del retiro o durante él.',
    'priority.investments.timeline': 'Se recomienda dentro de 60 días',
    'priority.tax.title': 'Mejore su diversificación fiscal',
    'priority.tax.why':
      'Tener pocos tipos de cuenta puede reducir su flexibilidad de retiros de fondos más adelante.',
    'priority.tax.impact':
      'Apoya un manejo fiscal más eficiente a lo largo de su retiro.',
    'priority.tax.timeline': 'Se recomienda dentro de 60 a 90 días',
    'priority.healthcare.title': 'Prepare la salud y los cuidados de largo plazo',
    'priority.healthcare.why':
      'Las brechas en la planificación de salud o de cuidados de largo plazo pueden generar costos de retiro grandes e inesperados.',
    'priority.healthcare.impact':
      'Protege su capital de los golpes por costos médicos y de cuidados.',
    'priority.healthcare.timeline': 'Se recomienda dentro de 60 a 90 días',
    'priority.estate.title': 'Complete la planificación patrimonial y de beneficiarios',
    'priority.estate.why':
      'La falta de documentos o los beneficiarios desactualizados pueden afectar a su familia y sus metas de legado.',
    'priority.estate.impact': 'Asegura que sus bienes se transfieran conforme a sus deseos.',
    'priority.estate.timeline': 'Se recomienda dentro de 60 a 90 días',
    'priority.whyScore': '(puntuación de {title}: {score}/100).',
    'level.critical': 'Crítico',
    'level.important': 'Importante',
    'level.longTerm': 'Largo plazo',
    'readiness.strong': 'Base de retiro sólida',
    'readiness.onTrack': 'En general en camino',
    'readiness.gaps': 'Brechas importantes por atender',
    'readiness.risks': 'Riesgos de retiro significativos',
    'readiness.immediate': 'Prioridades de planificación inmediatas',
    'narrative.high':
      '{prefix} de retiro muestra fundamentos sólidos, con oportunidades puntuales para afinar el diseño de ingresos y la planificación de longevidad.',
    'narrative.mid':
      '{prefix} de retiro es funcional, pero varias categorías necesitan atención antes de que el ingreso sea del todo sostenible.',
    'narrative.low':
      '{prefix} de retiro muestra brechas de preparación importantes que conviene atender pronto.',
    'narrative.prefixNamed': '{name}, su perfil',
    'narrative.prefixGeneric': 'Su perfil',
    'narrative.gap':
      'Queda una brecha anual estimada de ingresos de {gap} con los supuestos actuales.',
    'narrative.noGap':
      'Actualmente el ingreso proyectado cubre la meta de gasto que modelamos.',
    'narrative.retired':
      'Como ya está retirado(a), este reporte enfatiza la sostenibilidad, los retiros de fondos, la salud, los impuestos y el legado.',
    'narrative.disclaimer':
      'Estos resultados son educativos y no garantizan resultados de retiro.',
    'blueprint.vision': 'Aclarar su visión y su plazo de retiro',
    'blueprint.savings': 'Acelerar los ahorros y las aportaciones para el retiro',
    'blueprint.income-sources': 'Fortalecer las fuentes confiables de ingreso de retiro',
    'blueprint.income-adequacy': 'Cerrar su brecha de ingresos de retiro',
    'blueprint.investments': 'Alinear el riesgo de inversión y la diversificación',
    'blueprint.tax': 'Mejorar la diversificación y la eficiencia fiscal',
    'blueprint.healthcare':
      'Prepararse para los costos de salud y de cuidados de largo plazo',
    'blueprint.estate':
      'Completar la planificación patrimonial, de beneficiarios y de legado',
    'blueprint.lifetimeIncome': 'Crear un plan sostenible de ingresos de por vida',
    'action.retiredWithdrawal':
      'Revise la sostenibilidad de sus retiros de fondos frente a una longevidad de {longevityAge} años.',
    'action.retiredSpendingCheck':
      'Confirme su gasto mensual actual frente a su ingreso garantizado y el de su portafolio.',
    'action.retiredDocument':
      'Documente sus prioridades de salud, impuestos y legado para los próximos 90 días.',
    'action.workingHighestRisk': 'Atienda la categoría de retiro con mayor riesgo.',
    'action.workingContribution':
      'Confirme la automatización de sus aportaciones y la aportación del empleador.',
    'action.workingGap':
      'Cuantifique y comience a cerrar la brecha anual de ingresos de {gap}.',
    'action.workingValidate':
      'Verifique que el ingreso proyectado siga cubriendo su meta de gasto en el retiro.',
    'action.meetStrategist':
      'Reúnase con un estratega financiero de Valtoris para revisar su Retirement Report Card™',
    'action.savingsIncomeList':
      'Cree una lista escrita de acciones de ahorro e ingresos para 12 meses.',
    'action.taxSequencing':
      'Revise el orden de sus retiros de fondos para que sea eficiente en impuestos.',
    'action.reviewAllocation':
      'Revise la distribución de sus inversiones frente a su plazo.',
    'action.taxDiversification':
      'Mejore la diversificación fiscal entre los tipos de cuenta.',
    'action.healthcareDocs':
      'Documente sus planes para Medicare y para financiar los cuidados de largo plazo.',
    'action.estateUpdate': 'Actualice sus documentos patrimoniales y sus beneficiarios.',
    'status.strength': 'Fortaleza',
    'status.opportunity': 'Oportunidad',
    'status.neutral': 'Neutral',
    'status.strong': 'Sólido',
    'status.stable': 'Estable',
    'status.needsAttention': 'Requiere atención',
    'status.priorityRisk': 'Riesgo prioritario',
    'chrome.currentScore': 'Puntuación actual',
    'chrome.letterGrade': 'Calificación con letra',
    'chrome.atAGlance': 'Un panorama general',
    'chrome.insightsTitle': 'Fortalezas y oportunidades',
    'chrome.insightsLead':
      'Dónde su plan de retiro está más fuerte hoy y dónde están las mejoras de mayor impacto.',
    'chrome.greatestStrengths': 'Mayores fortalezas',
    'chrome.biggestOpportunities': 'Mayores oportunidades',
    'chrome.immediate': 'Inmediato',
    'chrome.thirtyDays': '30 días',
    'chrome.ninetyDays': '90 días',
    'chrome.whyThisMatters': 'Por qué importa',
    'chrome.recommendedTimeline': 'Plazo recomendado',
    'chrome.priorityRank': 'Prioridad n.º {rank}',
    'hero.retirementStatusLabel': 'Estado de retiro',
    'hero.targetAgeLabel': 'Edad meta de retiro',
    'hero.alreadyRetired': 'Ya retirado(a)',
    'hero.retiredCopy':
      'El análisis enfatiza la sostenibilidad, los retiros de fondos, la salud, los impuestos y el legado.',
    'hero.yearsCopy': 'Faltan unos {years} {yearWord} para la edad de retiro que indicó.',
    'hero.strongestLabel': 'Categoría más fuerte',
    'hero.priorityLabel': 'Categoría prioritaria',
    'hero.categoryScoreCopy': 'Puntuación {score}/100 ({grade}).',
    'hero.gapLabel': 'Brecha mensual estimada de ingresos',
    'hero.gapCopy':
      'Necesidad de {need} · Razón de financiamiento de aproximadamente {fundedRatio} % · Tasa de ahorro de aproximadamente {savingsRate} %.',
    'fallback.strength': 'Evaluación completada',
    'fallback.opportunity': 'Siga afinando su plan de ingresos para el retiro',
    'snapshot.title': 'Su panorama de retiro',
    'snapshot.lead':
      'Su panorama de retiro destaca primero la necesidad mensual, el ingreso total proyectado y cualquier brecha estimada. Las métricas de apoyo que aparecen abajo incluyen activos, fuentes de ingreso y contexto por categoría. El ingreso garantizado tiene más peso que otras fuentes o las fuentes temporales.',
    'snapshot.highlightsLabel': 'Resumen principal de retiro',
    'snapshot.needLabel': 'Necesidad mensual estimada en el retiro',
    'snapshot.incomeLabel': 'Ingreso mensual total estimado',
    'snapshot.gapLabel': 'Brecha mensual estimada de ingresos',
    'snapshot.assetsLabel': 'Activos actuales de retiro',
    'snapshot.projectedAssetsLabel': 'Activos proyectados al momento del retiro',
    'snapshot.guaranteedLabel': 'Ingreso mensual garantizado',
    'snapshot.otherIncomeLabel': 'Otro ingreso mensual esperado',
    'snapshot.partTimeNote':
      ' (incluye ingreso temporal de medio tiempo: {amount} por ~{years} años)',
    'snapshot.portfolioLabel': 'Ingreso mensual estimado del portafolio',
    'snapshot.fundedRatioLabel': 'Razón de financiamiento',
    'snapshot.savingsRateLabel': 'Tasa de ahorro actual',
    'snapshot.yearsLabel': 'Años hasta el retiro',
    'snapshot.statusLabel': 'Estado de retiro',
    'snapshot.alreadyRetired': 'Ya retirado(a)',
    'snapshot.categoriesLabel': 'Categoría más fuerte / prioritaria',
    'snapshot.note':
      'Estos resultados son estimaciones educativas y no garantizan resultados de retiro. Los supuestos incluyen inflación, crecimiento, tasa de retiro de fondos y una longevidad de {longevityAge} años.',
    'assumption.inflation': 'Inflación',
    'assumption.preRetirementGrowth': 'Crecimiento antes del retiro',
    'assumption.retirementReturn': 'Rendimiento durante el retiro',
    'assumption.withdrawalRate': 'Tasa de retiro de fondos',
    'assumption.longevityAge': 'Edad de longevidad',
    'pathways.title': 'Posibles caminos de planificación',
    'pathways.lead':
      'Temas educativos que puede explorar con un estratega. Esta lista no es una recomendación de producto.',
    'pathways.1': 'Planificación de ingresos para el retiro',
    'pathways.2': 'Revisión del Seguro Social',
    'pathways.3': 'Análisis de pensión',
    'pathways.4': 'Revisión de traspaso de 401(k), 403(b), IRA o TSP',
    'pathways.5': 'Análisis de ingresos de por vida y anualidades',
    'pathways.6': 'Planificación Roth y de diversificación fiscal',
    'pathways.7': 'Planificación de Medicare y de cuidados de largo plazo',
    'pathways.8': 'Revisión de seguro de vida',
    'pathways.9': 'Revisión patrimonial y de beneficiarios',
  },
}

export const retirementCopy: SpecializedProductCopy = {
  en: RETIREMENT_COPY_EN,
  es: RETIREMENT_COPY_ES,
}
