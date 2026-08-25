import type { SpecializedCopyCatalog, SpecializedProductCopy } from '../specialized/types'

const FAMILY_COPY_EN: SpecializedCopyCatalog = {
  questions: {},
  helpers: {
    step2: 'Tell us a little about your household so we can personalize your report card.',
    step3: "Help us understand your household's financial starting point.",
    step4: "Let's review how prepared your family is for life's unexpected moments.",
    step4Guardian: 'Because you reported dependents, we need one more estate planning detail.',
    step5: 'Select all the goals that matter most to your family right now.',
    cashFlow: 'Think about a typical month after your required bills are paid.',
    retirement: 'Include workplace plans and personal retirement accounts.',
    disability:
      'Disability income protection replaces part of your paycheck if illness or injury keeps you from working.',
    guardian: 'Guardianship preferences name who would care for your children.',
  },
  fields: {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    age: 'Age',
    state: 'State',
    maritalStatus: 'Marital Status',
    numberOfChildren: 'Number of Children',
    householdIncome: 'Household Income',
    monthlyHousingPayment: 'Monthly Housing Payment',
    totalDebt: 'Total Debt',
    emergencyFundMonths: 'Emergency Fund Months',
    monthlyCashFlow:
      'Which best describes your household’s monthly cash flow after required expenses?',
    retirementContribution: 'Which best describes your retirement savings contributions today?',
    currentLifeInsurance: 'Current Life Insurance',
    hasDisabilityProtection:
      'Do you have disability income protection (through work or an individual policy)?',
    hasWill: 'Has Will?',
    hasTrust: 'Has Trust?',
    beneficiariesReviewed: 'Beneficiaries Reviewed?',
    guardianDocumented:
      'Have you documented guardianship preferences for your children in your estate plan?',
    goals: 'What are you working toward?',
  },
  answers: {
    yes: 'Yes',
    no: 'No',
    'maritalStatus.single': 'Single',
    'maritalStatus.married': 'Married',
    'maritalStatus.divorced': 'Divorced',
    'maritalStatus.widowed': 'Widowed',
    'maritalStatus.domestic-partnership': 'Domestic Partnership',
    'monthlyCashFlow.save-most-months': 'We consistently save money most months',
    'monthlyCashFlow.break-even': 'We usually break even',
    'monthlyCashFlow.overspend': 'We often spend more than we take in',
    'monthlyCashFlow.unsure': "I'm not sure",
    'retirementContribution.not-saving': 'I am not currently saving for retirement',
    'retirementContribution.under-3': 'Less than 3% of household income',
    'retirementContribution.3-5': '3% to 5% of household income',
    'retirementContribution.6-10': '6% to 10% of household income',
    'retirementContribution.11-15': '11% to 15% of household income',
    'retirementContribution.over-15': 'More than 15% of household income',
    'goals.protect-family': 'Protect my family',
    'goals.debt-free': 'Become debt free',
    'goals.build-wealth': 'Build wealth',
    'goals.reduce-taxes': 'Reduce taxes',
    'goals.retire': 'Retire comfortably',
    'goals.college': 'Pay for college',
    'goals.legacy': 'Leave a legacy',
    'cashFlowPhrase.save-most-months': 'consistently saving most months',
    'cashFlowPhrase.break-even': 'usually breaking even',
    'cashFlowPhrase.overspend': 'often spending more than you take in',
    'cashFlowPhrase.unsure': 'uncertainty about monthly cash flow',
    'retirementPhrase.not-saving': 'not currently saving for retirement',
    'retirementPhrase.under-3': 'saving less than 3% of household income',
    'retirementPhrase.3-5': 'saving 3% to 5% of household income',
    'retirementPhrase.6-10': 'saving 6% to 10% of household income',
    'retirementPhrase.11-15': 'saving 11% to 15% of household income',
    'retirementPhrase.over-15': 'saving more than 15% of household income',
    'retirementPhrase.unspecified': 'an unspecified savings rate',
  },
  placeholders: {
    firstName: 'Enter your first name',
    lastName: 'Enter your last name',
    email: 'you@email.com',
    phone: '(555) 555-5555',
    age: 'Enter your age',
    children: '0',
    income: '120,000',
    housing: '2,500',
    debt: '45,000',
    emergencyMonths: '3',
    lifeInsurance: '250,000',
  },
  validation: {
    consentRequired: 'Please confirm the required acknowledgments before continuing.',
    submitFailed: 'We could not save your Family Report Card™. Please try again.',
    retry: 'Try again',
    ingestUnavailable:
      'Your answers were reviewed on this device. They were not sent to Valtoris CRM.',
  },
  ui: {
    welcomeTitle: 'Start Your Family Financial Report Card™',
    welcomeBody:
      'Answer a few simple questions so we can show where your family stands today.',
    startCta: 'Get My Free Family Financial Report Card™',
    backToOverview: 'Back to Overview',
    back: 'Back',
    continue: 'Continue',
    viewResults: 'View My Report Card',
    saving: 'Saving your Initial Financial Diagnostic…',
    stepIndicator: 'Step {current} of {total}',
    languageGroupLabel: 'Language',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    consentHeading: 'Acknowledgments',
    consentIntro:
      'Your Family Report Card™ provides an Initial Financial Diagnostic based on the information you shared. Required acknowledgments are marked with an asterisk.',
    consentStorage:
      'I understand that Valtoris will use the information I provide to calculate and store my {storageResultName} and related results.',
    consentStorageHint: 'Required acknowledgment to save and calculate your diagnostic.',
    consentStorageError:
      'Please acknowledge that your information will be used to calculate and store your diagnostic.',
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
      'Results are educational estimates based on self-reported information. They are not financial, legal, tax, investment, credit, or insurance advice, and they are not a guarantee. An advisor review may reach different conclusions.',
    consentHoneypot: 'Company website',
    productTitle: 'Family Report Card™',
    storageResultName: 'Initial Financial Diagnostic',
    step2Title: 'About Your Family',
    step3Title: 'Financial Foundation',
    step4Title: 'Protection & Legacy',
    step4GuardianTitle: 'Guardianship Planning',
    step5Title: 'Goals',
    landingEyebrow: 'VALTORIS FAMILY FINANCIAL REPORT CARD™',
    landingTitle: 'How Financially Prepared Is Your Family?',
    landingHero1:
      'Take the complimentary 2-minute Valtoris Family Financial Report Card™ to evaluate cash flow, emergency reserves, debt, protection, retirement readiness, estate planning, credit, and financial independence.',
    landingHero2:
      'See what appears to be working, where your family may be exposed, and what to address next.',
    landingMicrocopy:
      'Takes approximately two minutes. No cost. No obligation. Results are estimates, not guarantees.',
    landingReceiveHeading: "What You'll Receive",
    landingReceiveLead:
      'Four deliverables designed to turn a short assessment into clear financial direction.',
    landingReceive1Title: 'Overall Financial Score',
    landingReceive1Description:
      'A clear household score and letter grade that shows where you stand today.',
    landingReceive2Title: 'Personalized Category Scores',
    landingReceive2Description:
      'Category-by-category results so you can see strengths and weak spots side by side.',
    landingReceive3Title: 'Risk Analysis',
    landingReceive3Description: 'A focused view of where your family may be financially exposed.',
    landingReceive4Title: 'Action Blueprint',
    landingReceive4Description:
      'Immediate, 30-day, and 90-day priorities tailored to your answers.',
    landingSampleHeading: 'Sample Report Preview',
    landingSampleLead:
      'An illustrative look at the score, category detail, and action plan you can expect.',
    landingSampleBadge: 'Sample Report Preview',
    landingSampleAriaLabel: 'Sample Family Financial Report Card preview',
    landingSampleScore: 'Overall Score',
    landingSampleGrade: 'Grade',
    landingSampleStrongest: 'Strongest Area',
    landingSamplePriority: 'Priority Area',
    landingSampleImmediate: 'Immediate Priorities',
    landingSample30: '30-Day Action Plan',
    landingSample90: '90-Day Action Plan',
    landingSampleDisclaimer:
      'Illustrative sample only. Your personalized results will reflect your answers.',
    landingSampleBarCashflow: 'Cash Flow',
    landingSampleBarEmergency: 'Emergency Fund',
    landingSampleBarDebt: 'Debt Management',
    landingSampleBarProtection: 'Protection',
    landingSampleImmediate1: 'Improve protection coverage',
    landingSampleImmediate2: 'Increase emergency savings',
    landingSample30_1: 'Review insurance',
    landingSample30_2: 'Build first emergency goal',
    landingSample90_1: 'Complete estate planning',
    landingSample90_2: 'Increase retirement savings',
    landingCategoriesHeading: 'Categories Evaluated',
    landingCategoriesLead:
      'Your Report Card reviews the eight areas that shape a coordinated family financial foundation.',
    landingCategory1Title: 'Cash Flow and Budget',
    landingCategory1Description:
      'See how income, spending, and monthly flexibility support your goals.',
    landingCategory2Title: 'Emergency Preparedness',
    landingCategory2Description:
      'Evaluate whether reserves can cover unexpected expenses or income disruption.',
    landingCategory3Title: 'Debt Management',
    landingCategory3Description: 'Understand how balances and payments may be limiting progress.',
    landingCategory4Title: 'Protection and Insurance',
    landingCategory4Description: 'Identify where coverage may leave your household exposed.',
    landingCategory5Title: 'Retirement Readiness',
    landingCategory5Description:
      'Check whether current savings habits align with long-term income needs.',
    landingCategory6Title: 'Estate and Legacy Planning',
    landingCategory6Description: 'Review wills, trusts, and documents that protect the people you love.',
    landingCategory7Title: 'Credit Health',
    landingCategory7Description: 'Assess credit strength and how it affects borrowing and opportunity.',
    landingCategory8Title: 'Financial Independence',
    landingCategory8Description:
      'Measure progress toward lasting freedom and family financial resilience.',
    landingHowHeading: 'How It Works',
    landingHowLead: 'From your first answers to a clearer next step in four focused stages.',
    landingHow1Title: 'Answer Questions',
    landingHow1Description:
      'Complete a focused set of household finance questions in about two minutes.',
    landingHow2Title: 'Receive Results',
    landingHow2Description:
      'Get your score, grade, and category breakdown immediately after finishing.',
    landingHow3Title: 'Review Blueprint',
    landingHow3Description: 'See what is working, what may be exposed, and what to prioritize next.',
    landingHow4Title: 'Schedule Strategy Session',
    landingHow4Description:
      'Optionally review your results in a complimentary strategy conversation.',
    landingFaqHeading: 'Frequently Asked Questions',
    landingFaqLead: 'Straightforward answers before you begin.',
    landingFaq1: 'How long does the Family Report Card take?',
    landingFaqA1: 'Most families finish in about two minutes. No account creation is required.',
    landingFaq2: 'Is it free?',
    landingFaqA2:
      'Yes. The Valtoris Family Financial Report Card™ is complimentary with no obligation.',
    landingFaq3: 'Are the results guaranteed?',
    landingFaqA3:
      'No. Results are educational estimates based on your answers. They do not guarantee financial outcomes.',
    landingFaq4: 'Do I have to purchase anything?',
    landingFaqA4: 'No. You receive your results whether or not you choose to take a next step.',
    landingFaq5: 'Will someone contact me?',
    landingFaqA5:
      'Only if you choose to continue with a strategy conversation. Completing the report card alone does not create a sales commitment.',
    landingFaq6: 'Is my information secure?',
    landingFaqA6:
      'Your answers are used to generate your personalized results and are handled with care for educational planning purposes.',
    landingFaq7: 'Can I retake it later?',
    landingFaqA7: 'Yes. You can retake the assessment anytime your situation changes.',
    landingClosingTitle: 'Ready to See Where Your Family Stands?',
    landingClosingCopy:
      'Take the first step and receive a clearer picture of your score, risks, and next priorities.',
    landingClosingMicrocopy:
      'Takes approximately two minutes. No cost. No obligation. Results are estimates, not guarantees.',
    resultsDiagnosticLabel: 'Family Financial Report Card™ · Initial Financial Diagnostic',
    resultsDisclaimer:
      'These results are educational estimates based on self-reported information. They are not financial, legal, tax, investment, credit, or insurance advice, and they are not a guarantee. An advisor review may reach different conclusions.',
    resultsScheduleTitle: 'Schedule Complimentary Strategy Session™',
    resultsScheduleCopy:
      "Review your Family Financial Report Card™ with a Valtoris strategist and receive a customized action plan for protecting and growing your family's wealth.",
    resultsRetake: 'Retake Assessment',
    resultsProtectionCta: 'Start My Family Protection Analysis™',
    preparedFor: 'Prepared for {name}',
    sampleGreeting: 'Sample Family Report Card',
  },
  results: {
    title: 'Your Family Financial Report Card™',
    scoreLabel: 'Overall Financial Score™',
    glanceLead: 'Your financial foundation across six categories.',
    prioritiesTitle: 'Top 3 Priorities™',
    prioritiesLead: 'Highest-impact recommendations for your family.',
    impactLabel: 'Family Impact',
    actionPlanTitle: 'Family Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day next steps personalized from your report.',
    categoriesTitle: 'Your Financial Score Breakdown™',
    categoriesLead:
      "Review each financial category, understand your score, and discover personalized recommendations to strengthen your family's financial foundation.",
    blueprintTitle: 'Family Financial Blueprint™',
    blueprintCopy:
      'This report helps families identify strengths, exposures, and the highest-impact opportunities to protect income and build lasting wealth.',
    statusMetricLabel: 'Risk Level',
    recommendationsSubhead: 'Next steps',
    footer1: 'Powered by Valtoris Financial™',
    footer2: 'Helping Families Become Legacy Ready™',
    'category.cashflow': 'Cash Flow & Budget',
    'category.emergency': 'Emergency Fund',
    'category.debt': 'Debt Management',
    'category.protection': 'Insurance & Protection',
    'category.retirement': 'Retirement Readiness',
    'category.estate': 'Estate & Legacy',
    'summary.cashflow.high': 'Healthy housing burden and positive monthly cash flow.',
    'summary.cashflow.mid':
      'Cash flow is manageable, but housing or spending patterns need attention.',
    'summary.cashflow.low':
      'Housing costs or spending patterns are putting pressure on monthly cash flow.',
    'summary.emergency.high': 'Emergency reserves appear adequate for short-term disruptions.',
    'summary.emergency.mid':
      'You have some reserves, but may not fully weather a major disruption.',
    'summary.emergency.low': 'Emergency reserves may not fully support your household.',
    'summary.debt.high': 'Debt levels appear manageable relative to income.',
    'summary.debt.mid': 'Debt is serviceable but may limit financial flexibility.',
    'summary.debt.low': 'Debt levels may be creating meaningful financial pressure.',
    'summary.protection.high':
      'Life and disability protection appear reasonably aligned with household need.',
    'summary.protection.mid': 'Coverage exists, but important protection gaps may remain.',
    'summary.protection.low':
      'Coverage and disability protection appear insufficient for your household profile.',
    'summary.retirement.high': 'Retirement savings contributions appear strong for your household.',
    'summary.retirement.mid':
      'You are saving for retirement, but contributions may need to increase.',
    'summary.retirement.low': 'Retirement savings appear limited or not yet established.',
    'summary.estate.high': 'Estate documents and beneficiary planning appear in good order.',
    'summary.estate.mid':
      'Some estate planning elements are in place, but updates may be needed.',
    'summary.estate.low': 'Estate documents and beneficiary designations need attention.',
    'guidance.cashflow':
      'Healthy cash flow is the foundation of every financial plan — it creates flexibility for protection, savings, and legacy goals.',
    'guidance.emergency':
      'An adequate emergency fund prevents forced debt and protects long-term goals during unexpected events.',
    'guidance.debt':
      'Strategic debt management frees cash flow for protection and long-term wealth building.',
    'guidance.protection':
      "Protection planning helps ensure your family can maintain their standard of living through life's unexpected events.",
    'guidance.retirement':
      'Consistent retirement savings compound over time — small increases today can significantly improve outcomes.',
    'guidance.estate':
      'Estate planning ensures your assets and wishes are honored — protecting your family beyond your lifetime.',
    'rec.cashflow.high1': 'Maintain your current savings discipline.',
    'rec.cashflow.high2': 'Review tax-advantaged savings opportunities annually.',
    'rec.cashflow.low1': 'Build a simple monthly budget focused on saving consistently.',
    'rec.cashflow.low2': 'Automate transfers to savings on payday.',
    'rec.cashflow.ratio1': 'Reduce housing burden or increase income where possible.',
    'rec.cashflow.ratio2':
      'Track essential expenses for 30 days to identify savings opportunities.',
    'rec.emergency.high1': 'Maintain 6+ months of essential expenses in liquid reserves.',
    'rec.emergency.high2': 'Review fund location annually for accessibility.',
    'rec.emergency.low1': 'Increase reserves toward 6 months of essential expenses.',
    'rec.emergency.low2': 'Keep emergency funds in liquid, accessible accounts.',
    'rec.emergency.lowMonths1':
      'Build toward 3–6 months of essential expenses in accessible savings.',
    'rec.emergency.lowMonths2': 'Automate monthly transfers to accelerate fund growth.',
    'rec.debt.high1': 'Maintain disciplined payoff habits while preserving emergency savings.',
    'rec.debt.high2': 'Avoid taking on high-interest debt for non-essential purchases.',
    'rec.debt.low1': 'Prioritize high-interest balances while preserving emergency savings.',
    'rec.debt.low2': 'Consider consolidating where rates and terms improve cash flow.',
    'rec.protection.high1': 'Review policy beneficiaries and coverage amounts annually.',
    'rec.protection.high2': 'Confirm disability protection covers essential household expenses.',
    'rec.protection.low1': 'Compare current coverage against your estimated household need.',
    'rec.protection.low2': 'Review living benefits and coverage limits for both earners.',
    'rec.protection.gap1': 'Address the estimated {gap} Protection Gap™.',
    'rec.protection.disabilityYes':
      'Review living benefits and disability coverage limits for both earners.',
    'rec.protection.disabilityNo': 'Add disability income protection to help protect paychecks.',
    'rec.protection.ok1': 'Review policy beneficiaries and coverage amounts annually.',
    'rec.protection.ok2': 'Confirm disability protection covers essential household expenses.',
    'rec.retirement.high1': 'Maintain or increase contribution rates with income growth.',
    'rec.retirement.high2': 'Review investment allocation with your time horizon in mind.',
    'rec.retirement.low1': 'Increase retirement contributions by 1–2% of household income.',
    'rec.retirement.low2': 'Review employer match opportunities if available.',
    'rec.retirement.notSaving1': 'Start retirement contributions through employer or IRA accounts.',
    'rec.retirement.notSaving2':
      'Automate contributions each pay period, even at a modest percentage.',
    'rec.retirement.increase1': 'Increase retirement contributions by 1–2% of household income.',
    'rec.retirement.increase2': 'Review employer match opportunities if available.',
    'rec.estate.high1': 'Review estate documents every 3–5 years or after major life changes.',
    'rec.estate.high2': 'Confirm beneficiary designations on all accounts and policies.',
    'rec.estate.low1': 'Update wills, trusts, and beneficiary forms to reflect current wishes.',
    'rec.estate.low2': 'Confirm beneficiary designations match your current wishes.',
    'rec.estate.children': 'Document guardianship preferences for dependents.',
    'rec.estate.noChildren': 'Document asset transfer wishes and key account beneficiaries.',
    'explanation.cashflow':
      'Your housing payment represents {ratio} of household income, and you reported "{cashFlowPhrase}."',
    'explanation.emergency':
      'You reported {months} {monthWord} of expenses set aside in emergency savings.',
    'explanation.debt':
      'Your total debt is {debt} against {income} household income ({dti} debt-to-income).',
    'explanation.protection':
      'Based on your reported income, marital status, and {children} {childWord}, estimated life insurance need is {need}. Current coverage is {coverage} ({coverageRatio} of estimated need). Disability protection: {disability}.',
    'explanation.retirement': 'You reported {contributionPhrase} toward retirement.',
    'explanation.retirementAge':
      'Age {age} provides context for your savings timeline, but your score is based on contribution behavior.',
    'explanation.estate': 'Will: {will}. Trust: {trust}. Beneficiaries reviewed: {beneficiaries}.',
    'explanation.estateGuardian': 'Guardian preferences documented: {guardian}.',
    'month.one': 'month',
    'month.many': 'months',
    'child.one': 'dependent',
    'child.many': 'dependents',
    'priority.protection.title': 'Close Your Family Protection Gap',
    'priority.protection.why':
      'Your reported life insurance and disability coverage may leave meaningful income and lifestyle risk.',
    'priority.protection.impact':
      "Helps protect your family's income, lifestyle, and long-term legacy if the unexpected happens.",
    'priority.protection.timeline': 'Recommended within 30–60 days',
    'priority.emergency.title': 'Strengthen Your Emergency Fund',
    'priority.emergency.why':
      'Your reported emergency reserves may not cover a major income or expense disruption.',
    'priority.emergency.impact':
      'Reduces reliance on debt during unexpected events and stabilizes long-term planning.',
    'priority.emergency.timeline': 'Recommended within 30–60 days',
    'priority.debt.title': 'Reduce High-Priority Debt Pressure',
    'priority.debt.why':
      'Your debt-to-income level may be limiting cash flow and financial flexibility.',
    'priority.debt.impact': 'Frees monthly cash flow for protection, savings, and legacy goals.',
    'priority.debt.timeline': 'Recommended within 60–90 days',
    'priority.estate.title': 'Complete Estate & Legacy Planning',
    'priority.estate.why':
      'Key estate documents or beneficiary designations appear incomplete or outdated.',
    'priority.estate.impact':
      'Reduces legal uncertainty and ensures assets transfer according to your wishes.',
    'priority.estate.timeline': 'Recommended within 60–90 days',
    'priority.retirement.title': 'Accelerate Retirement Readiness',
    'priority.retirement.why':
      'Your reported retirement contribution level may not support long-term independence goals.',
    'priority.retirement.impact':
      'Builds momentum toward financial independence and Legacy Ready™ status.',
    'priority.retirement.timeline': 'Recommended over the next 6–12 months',
    'priority.cashflow.title': 'Improve Monthly Cash Flow',
    'priority.cashflow.why':
      'Housing burden or spending patterns may be limiting your ability to save and protect income.',
    'priority.cashflow.impact':
      'Creates monthly flexibility to fund protection, reserves, and long-term goals.',
    'priority.cashflow.timeline': 'Recommended within 30–60 days',
    'priority.whyScore': '({title} score: {score}/100).',
    'level.critical': 'Critical',
    'level.important': 'Important',
    'level.longTerm': 'Long-Term',
    'foundation.legacy_ready': 'Legacy Ready™ Track',
    'foundation.strong': 'Strong Foundation',
    'foundation.momentum': 'Building Momentum',
    'foundation.stabilizing': 'Stabilizing Phase',
    'foundation.attention': 'Needs Immediate Attention',
    'narrative.high':
      '{prefix} family financial profile shows strong fundamentals with targeted opportunities to become Legacy Ready™.',
    'narrative.mid':
      '{prefix} family has a workable foundation, but several categories need attention to improve long-term stability.',
    'narrative.low':
      '{prefix} family profile shows meaningful financial vulnerabilities that should be addressed promptly.',
    'narrative.prefixNamed': '{name}, your',
    'narrative.prefixGeneric': 'Your',
    'blueprint.protection': 'Protect income',
    'blueprint.emergency': 'Build emergency savings',
    'blueprint.debt': 'Eliminate unnecessary debt',
    'blueprint.retirement': 'Prepare for retirement',
    'blueprint.cashflow': 'Strengthen monthly cash flow',
    'blueprint.estate': 'Create an estate plan',
    'blueprint.wealth': 'Build generational wealth',
    'action.meetStrategist': 'Meet with a Valtoris Financial Strategist',
    'action.reviewBeneficiaries': 'Review beneficiaries on all policies and accounts.',
    'action.reviewGap': 'Review your {gap} Protection Gap™ with an advisor.',
    'action.college': 'Review education funding targets for dependents.',
    'action.annualPlan': 'Update your annual family financial plan',
    'action.highestRisk': 'Address your highest-risk financial category.',
    'action.emergencyMomentum': 'Build emergency savings momentum.',
    'action.debtOrSavings': 'Create a debt or savings action plan.',
    'action.retirementTarget': 'Review retirement contribution targets.',
    'action.willTrust': 'Complete will & trust planning.',
    'action.wealth': 'Review long-term wealth-building priorities.',
    'status.strength': 'Low Risk',
    'status.opportunity': 'Moderate Risk',
    'status.neutral': 'Attention Needed',
    'chrome.currentScore': 'Current Score',
    'chrome.letterGrade': 'Letter Grade',
    'chrome.atAGlance': 'At a Glance',
    'chrome.insightsTitle': 'Strengths & Opportunities',
    'chrome.insightsLead':
      'Where your family is strongest today and where the highest-impact improvements live.',
    'chrome.greatestStrengths': 'Greatest Strengths',
    'chrome.biggestOpportunities': 'Biggest Opportunities',
    'chrome.protectionTitle': 'Protection Analysis',
    'chrome.protectionLead':
      "How well your current coverage protects your family's income and lifestyle.",
    'chrome.immediate': 'Immediate',
    'chrome.thirtyDays': '30 Days',
    'chrome.ninetyDays': '90 Days',
    'chrome.whyThisMatters': 'Why this matters',
    'chrome.recommendedTimeline': 'Recommended timeline',
    'chrome.priorityRank': 'Priority #{rank}',
    'hero.progressLabel': 'Progress Toward Legacy Ready™',
    'hero.progressCopy':
      'Measures how prepared your family is to protect income, build wealth, and become Legacy Ready™.',
    'hero.gapLabel': 'Protection Gap™',
    'hero.gapCopy':
      'Estimated additional protection your family may need beyond current coverage.',
    'protection.label': 'Family Protection Gap',
    'protection.note':
      "Closing this gap helps protect your family's income, lifestyle, and long-term legacy goals.",
    'fallback.strength': 'Financial assessment completed',
    'fallback.opportunity': 'Continue strengthening your financial foundation',
  },
}

const FAMILY_COPY_ES: SpecializedCopyCatalog = {
  questions: {},
  helpers: {
    step2: 'Cuéntenos un poco sobre su hogar para poder personalizar su Report Card.',
    step3: 'Ayúdenos a entender el punto de partida financiero de su hogar.',
    step4: 'Revisemos qué tan preparada está su familia para los imprevistos de la vida.',
    step4Guardian:
      'Como indicó que tiene dependientes, necesitamos un detalle más de planificación patrimonial.',
    step5: 'Seleccione todas las metas que más le importan a su familia en este momento.',
    cashFlow: 'Piense en un mes típico, después de pagar las cuentas obligatorias.',
    retirement: 'Incluya los planes del trabajo y las cuentas de retiro personales.',
    disability:
      'La protección de ingresos por discapacidad reemplaza parte de su sueldo si una enfermedad o lesión le impide trabajar.',
    guardian: 'Las preferencias de tutela indican quién cuidaría de sus hijos.',
  },
  fields: {
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    age: 'Edad',
    state: 'Estado',
    maritalStatus: 'Estado civil',
    numberOfChildren: 'Número de hijos',
    householdIncome: 'Ingreso del hogar',
    monthlyHousingPayment: 'Pago mensual de vivienda',
    totalDebt: 'Deuda total',
    emergencyFundMonths: 'Meses de fondo de emergencia',
    monthlyCashFlow:
      '¿Qué describe mejor el flujo de efectivo mensual de su hogar después de los gastos obligatorios?',
    retirementContribution:
      '¿Qué describe mejor sus aportaciones al ahorro para el retiro hoy?',
    currentLifeInsurance: 'Seguro de vida actual',
    hasDisabilityProtection:
      '¿Tiene protección de ingresos por discapacidad (por el trabajo o con una póliza individual)?',
    hasWill: '¿Tiene testamento?',
    hasTrust: '¿Tiene fideicomiso?',
    beneficiariesReviewed: '¿Ha revisado a sus beneficiarios?',
    guardianDocumented:
      '¿Ha documentado en su plan patrimonial las preferencias de tutela para sus hijos?',
    goals: '¿Qué está tratando de lograr?',
  },
  answers: {
    yes: 'Sí',
    no: 'No',
    'maritalStatus.single': 'Soltero(a)',
    'maritalStatus.married': 'Casado(a)',
    'maritalStatus.divorced': 'Divorciado(a)',
    'maritalStatus.widowed': 'Viudo(a)',
    'maritalStatus.domestic-partnership': 'Unión doméstica',
    'monthlyCashFlow.save-most-months': 'Ahorramos de forma constante la mayoría de los meses',
    'monthlyCashFlow.break-even': 'Normalmente quedamos en equilibrio',
    'monthlyCashFlow.overspend': 'A menudo gastamos más de lo que ingresamos',
    'monthlyCashFlow.unsure': 'No estoy seguro(a)',
    'retirementContribution.not-saving': 'Actualmente no estoy ahorrando para el retiro',
    'retirementContribution.under-3': 'Menos del 3 % del ingreso del hogar',
    'retirementContribution.3-5': 'Del 3 % al 5 % del ingreso del hogar',
    'retirementContribution.6-10': 'Del 6 % al 10 % del ingreso del hogar',
    'retirementContribution.11-15': 'Del 11 % al 15 % del ingreso del hogar',
    'retirementContribution.over-15': 'Más del 15 % del ingreso del hogar',
    'goals.protect-family': 'Proteger a mi familia',
    'goals.debt-free': 'Salir de deudas',
    'goals.build-wealth': 'Crear patrimonio',
    'goals.reduce-taxes': 'Reducir impuestos',
    'goals.retire': 'Retirarme con tranquilidad',
    'goals.college': 'Pagar la universidad',
    'goals.legacy': 'Dejar un legado',
    'cashFlowPhrase.save-most-months': 'que ahorran de forma constante la mayoría de los meses',
    'cashFlowPhrase.break-even': 'que normalmente quedan en equilibrio',
    'cashFlowPhrase.overspend': 'que a menudo gastan más de lo que ingresan',
    'cashFlowPhrase.unsure': 'incertidumbre sobre el flujo de efectivo mensual',
    'retirementPhrase.not-saving': 'que actualmente no está ahorrando',
    'retirementPhrase.under-3': 'que ahorra menos del 3 % del ingreso del hogar',
    'retirementPhrase.3-5': 'que ahorra del 3 % al 5 % del ingreso del hogar',
    'retirementPhrase.6-10': 'que ahorra del 6 % al 10 % del ingreso del hogar',
    'retirementPhrase.11-15': 'que ahorra del 11 % al 15 % del ingreso del hogar',
    'retirementPhrase.over-15': 'que ahorra más del 15 % del ingreso del hogar',
    'retirementPhrase.unspecified': 'una tasa de ahorro no especificada',
  },
  placeholders: {
    firstName: 'Escriba su nombre',
    lastName: 'Escriba su apellido',
    email: 'usted@correo.com',
    phone: '(555) 555-5555',
    age: 'Escriba su edad',
    children: '0',
    income: '120,000',
    housing: '2,500',
    debt: '45,000',
    emergencyMonths: '3',
    lifeInsurance: '250,000',
  },
  validation: {
    consentRequired: 'Confirme los reconocimientos obligatorios antes de continuar.',
    submitFailed: 'No pudimos guardar su Family Report Card™. Inténtelo de nuevo.',
    retry: 'Intentar de nuevo',
    ingestUnavailable:
      'Sus respuestas se revisaron en este dispositivo. No se enviaron al CRM de Valtoris.',
  },
  ui: {
    welcomeTitle: 'Comience su Family Financial Report Card™',
    welcomeBody:
      'Responda unas preguntas sencillas para mostrarle dónde está su familia hoy.',
    startCta: 'Obtenga gratis mi Family Financial Report Card™',
    backToOverview: 'Volver al resumen',
    back: 'Atrás',
    continue: 'Continuar',
    viewResults: 'Ver mi Report Card',
    saving: 'Guardando su diagnóstico financiero inicial…',
    stepIndicator: 'Paso {current} de {total}',
    languageGroupLabel: 'Idioma',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    consentHeading: 'Reconocimientos',
    consentIntro:
      'Su Family Report Card™ ofrece un diagnóstico financiero inicial basado en la información que compartió. Los reconocimientos obligatorios están marcados con un asterisco.',
    consentStorage:
      'Entiendo que Valtoris usará la información que proporciono para calcular y guardar mi {storageResultName} y los resultados relacionados.',
    consentStorageHint:
      'Reconocimiento obligatorio para guardar y calcular su diagnóstico.',
    consentStorageError:
      'Confirme que su información se usará para calcular y guardar su diagnóstico.',
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
    consentPrivacyError:
      'Revise y confirme la Política de privacidad antes de continuar.',
    consentDisclaimer:
      'Los resultados son estimaciones educativas basadas en la información que usted reporta. No son asesoría financiera, legal, fiscal, de inversiones, de crédito ni de seguros, y no constituyen una garantía. La revisión de un asesor puede llegar a conclusiones distintas.',
    consentHoneypot: 'Sitio web de la empresa',
    productTitle: 'Family Report Card™',
    storageResultName: 'Diagnóstico financiero inicial',
    step2Title: 'Sobre su familia',
    step3Title: 'Base financiera',
    step4Title: 'Protección y legado',
    step4GuardianTitle: 'Planificación de tutela',
    step5Title: 'Metas',
    landingEyebrow: 'VALTORIS FAMILY FINANCIAL REPORT CARD™',
    landingTitle: '¿Qué tan preparada está su familia en lo financiero?',
    landingHero1:
      'Complete sin costo el Valtoris Family Financial Report Card™ de dos minutos para evaluar el flujo de efectivo, las reservas de emergencia, las deudas, la protección, la preparación para el retiro, la planificación patrimonial, el crédito y la independencia financiera.',
    landingHero2:
      'Vea qué parece estar funcionando, dónde su familia podría estar expuesta y qué atender después.',
    landingMicrocopy:
      'Toma unos dos minutos. Sin costo. Sin compromiso. Los resultados son estimaciones, no garantías.',
    landingReceiveHeading: 'Qué recibirá',
    landingReceiveLead:
      'Cuatro entregables diseñados para convertir una evaluación breve en una dirección financiera clara.',
    landingReceive1Title: 'Puntuación financiera general',
    landingReceive1Description:
      'Una puntuación clara del hogar y una calificación con letra que muestran dónde está hoy.',
    landingReceive2Title: 'Puntuaciones personalizadas por categoría',
    landingReceive2Description:
      'Resultados categoría por categoría para ver sus fortalezas y sus puntos débiles uno al lado del otro.',
    landingReceive3Title: 'Análisis de riesgos',
    landingReceive3Description:
      'Una vista enfocada de dónde su familia podría estar expuesta en lo financiero.',
    landingReceive4Title: 'Plan de acción',
    landingReceive4Description:
      'Prioridades inmediatas, a 30 días y a 90 días, adaptadas a sus respuestas.',
    landingSampleHeading: 'Vista previa de un reporte de ejemplo',
    landingSampleLead:
      'Una muestra ilustrativa de la puntuación, el detalle por categoría y el plan de acción que puede esperar.',
    landingSampleBadge: 'Vista previa de ejemplo',
    landingSampleAriaLabel: 'Vista previa de ejemplo del Family Financial Report Card™',
    landingSampleScore: 'Puntuación general',
    landingSampleGrade: 'Calificación',
    landingSampleStrongest: 'Área más fuerte',
    landingSamplePriority: 'Área prioritaria',
    landingSampleImmediate: 'Prioridades inmediatas',
    landingSample30: 'Plan de acción a 30 días',
    landingSample90: 'Plan de acción a 90 días',
    landingSampleDisclaimer:
      'Solo es un ejemplo ilustrativo. Sus resultados personalizados reflejarán sus respuestas.',
    landingSampleBarCashflow: 'Flujo de efectivo',
    landingSampleBarEmergency: 'Fondo de emergencia',
    landingSampleBarDebt: 'Manejo de deudas',
    landingSampleBarProtection: 'Protección',
    landingSampleImmediate1: 'Mejorar la cobertura de protección',
    landingSampleImmediate2: 'Aumentar el ahorro de emergencia',
    landingSample30_1: 'Revisar los seguros',
    landingSample30_2: 'Alcanzar la primera meta de emergencia',
    landingSample90_1: 'Completar la planificación patrimonial',
    landingSample90_2: 'Aumentar el ahorro para el retiro',
    landingCategoriesHeading: 'Categorías evaluadas',
    landingCategoriesLead:
      'Su Report Card revisa las ocho áreas que forman una base financiera familiar coordinada.',
    landingCategory1Title: 'Flujo de efectivo y presupuesto',
    landingCategory1Description:
      'Vea cómo el ingreso, los gastos y la flexibilidad mensual apoyan sus metas.',
    landingCategory2Title: 'Preparación para emergencias',
    landingCategory2Description:
      'Evalúe si sus reservas pueden cubrir gastos imprevistos o una interrupción del ingreso.',
    landingCategory3Title: 'Manejo de deudas',
    landingCategory3Description:
      'Entienda cómo los saldos y los pagos podrían estar limitando su progreso.',
    landingCategory4Title: 'Protección y seguros',
    landingCategory4Description:
      'Identifique dónde la cobertura podría dejar expuesto a su hogar.',
    landingCategory5Title: 'Preparación para el retiro',
    landingCategory5Description:
      'Verifique si sus hábitos de ahorro actuales corresponden a sus necesidades de ingreso a largo plazo.',
    landingCategory6Title: 'Planificación patrimonial y de legado',
    landingCategory6Description:
      'Revise testamentos, fideicomisos y documentos que protegen a las personas que ama.',
    landingCategory7Title: 'Salud crediticia',
    landingCategory7Description:
      'Evalúe la fortaleza de su crédito y cómo afecta su capacidad de financiamiento y sus oportunidades.',
    landingCategory8Title: 'Independencia financiera',
    landingCategory8Description:
      'Mida su avance hacia una libertad duradera y una mayor resiliencia financiera familiar.',
    landingHowHeading: 'Cómo funciona',
    landingHowLead:
      'De sus primeras respuestas a un siguiente paso más claro, en cuatro etapas enfocadas.',
    landingHow1Title: 'Responda las preguntas',
    landingHow1Description:
      'Complete un conjunto enfocado de preguntas sobre las finanzas del hogar en unos dos minutos.',
    landingHow2Title: 'Reciba sus resultados',
    landingHow2Description:
      'Obtenga su puntuación, su calificación y el desglose por categoría en cuanto termine.',
    landingHow3Title: 'Revise su plan',
    landingHow3Description:
      'Vea qué está funcionando, qué podría estar expuesto y qué priorizar después.',
    landingHow4Title: 'Agende una sesión de estrategia',
    landingHow4Description:
      'De forma opcional, revise sus resultados en una conversación de estrategia sin costo.',
    landingFaqHeading: 'Preguntas frecuentes',
    landingFaqLead: 'Respuestas claras antes de comenzar.',
    landingFaq1: '¿Cuánto tiempo toma el Family Report Card™?',
    landingFaqA1:
      'La mayoría de las familias termina en unos dos minutos. No necesita crear una cuenta.',
    landingFaq2: '¿Es gratis?',
    landingFaqA2:
      'Sí. El Valtoris Family Financial Report Card™ es sin costo y sin compromiso.',
    landingFaq3: '¿Los resultados están garantizados?',
    landingFaqA3:
      'No. Los resultados son estimaciones educativas basadas en sus respuestas. No garantizan resultados financieros.',
    landingFaq4: '¿Tengo que comprar algo?',
    landingFaqA4:
      'No. Usted recibe sus resultados, decida o no dar un paso siguiente.',
    landingFaq5: '¿Alguien se comunicará conmigo?',
    landingFaqA5:
      'Solo si usted decide continuar con una conversación de estrategia. Completar el Report Card por sí solo no crea ningún compromiso de compra.',
    landingFaq6: '¿Mi información está segura?',
    landingFaqA6:
      'Sus respuestas se usan para generar sus resultados personalizados y se manejan con cuidado para fines educativos de planificación.',
    landingFaq7: '¿Puedo repetirlo más adelante?',
    landingFaqA7:
      'Sí. Puede repetir la evaluación cuando cambie su situación.',
    landingClosingTitle: '¿Listo para ver dónde está su familia?',
    landingClosingCopy:
      'Dé el primer paso y reciba una imagen más clara de su puntuación, sus riesgos y sus próximas prioridades.',
    landingClosingMicrocopy:
      'Toma unos dos minutos. Sin costo. Sin compromiso. Los resultados son estimaciones, no garantías.',
    resultsDiagnosticLabel: 'Family Financial Report Card™ · Diagnóstico financiero inicial',
    resultsDisclaimer:
      'Estos resultados son estimaciones educativas basadas en la información que usted reporta. No son asesoría financiera, legal, fiscal, de inversiones, de crédito ni de seguros, y no constituyen una garantía. La revisión de un asesor puede llegar a conclusiones distintas.',
    resultsScheduleTitle: 'Agende su sesión de estrategia sin costo™',
    resultsScheduleCopy:
      'Revise su Family Financial Report Card™ con un estratega de Valtoris y reciba un plan de acción personalizado para proteger y hacer crecer el patrimonio de su familia.',
    resultsRetake: 'Repetir la evaluación',
    resultsProtectionCta: 'Comenzar mi Family Protection Analysis™',
    preparedFor: 'Preparado para {name}',
    sampleGreeting: 'Family Report Card™ de ejemplo',
  },
  results: {
    title: 'Su Family Financial Report Card™',
    scoreLabel: 'Puntuación financiera general™',
    glanceLead: 'Su base financiera en seis categorías.',
    prioritiesTitle: 'Las 3 prioridades principales™',
    prioritiesLead: 'Las recomendaciones de mayor impacto para su familia.',
    impactLabel: 'Impacto para la familia',
    actionPlanTitle: 'Plan de acción familiar™',
    actionPlanLead:
      'Pasos inmediatos, a 30 días y a 90 días, personalizados a partir de su reporte.',
    categoriesTitle: 'Desglose de su puntuación financiera™',
    categoriesLead:
      'Revise cada categoría financiera, entienda su puntuación y descubra recomendaciones personalizadas para fortalecer la base financiera de su familia.',
    blueprintTitle: 'Plan maestro financiero familiar™',
    blueprintCopy:
      'Este reporte ayuda a las familias a identificar fortalezas, exposiciones y las oportunidades de mayor impacto para proteger el ingreso y crear patrimonio duradero.',
    statusMetricLabel: 'Nivel de riesgo',
    recommendationsSubhead: 'Próximos pasos',
    footer1: 'Desarrollado por Valtoris Financial™',
    footer2: 'Ayudamos a las familias a ser Legacy Ready™',
    'category.cashflow': 'Flujo de efectivo y presupuesto',
    'category.emergency': 'Fondo de emergencia',
    'category.debt': 'Manejo de deudas',
    'category.protection': 'Seguros y protección',
    'category.retirement': 'Preparación para el retiro',
    'category.estate': 'Patrimonio y legado',
    'summary.cashflow.high':
      'La carga de vivienda es saludable y el flujo de efectivo mensual es positivo.',
    'summary.cashflow.mid':
      'El flujo de efectivo es manejable, pero la vivienda o los hábitos de gasto necesitan atención.',
    'summary.cashflow.low':
      'El costo de la vivienda o los hábitos de gasto están presionando el flujo de efectivo mensual.',
    'summary.emergency.high':
      'Las reservas de emergencia parecen adecuadas para interrupciones de corto plazo.',
    'summary.emergency.mid':
      'Tiene algunas reservas, pero podrían no ser suficientes ante una interrupción mayor.',
    'summary.emergency.low':
      'Las reservas de emergencia podrían no sostener por completo a su hogar.',
    'summary.debt.high': 'El nivel de deuda parece manejable en relación con el ingreso.',
    'summary.debt.mid':
      'La deuda es pagable, pero podría limitar su flexibilidad financiera.',
    'summary.debt.low':
      'El nivel de deuda podría estar generando una presión financiera importante.',
    'summary.protection.high':
      'La protección de vida y por discapacidad parece razonablemente alineada con la necesidad del hogar.',
    'summary.protection.mid':
      'Existe cobertura, pero podrían quedar vacíos de protección importantes.',
    'summary.protection.low':
      'La cobertura y la protección por discapacidad parecen insuficientes para el perfil de su hogar.',
    'summary.retirement.high':
      'Las aportaciones al ahorro para el retiro parecen sólidas para su hogar.',
    'summary.retirement.mid':
      'Está ahorrando para el retiro, pero quizá necesite aumentar las aportaciones.',
    'summary.retirement.low':
      'El ahorro para el retiro parece limitado o aún no está establecido.',
    'summary.estate.high':
      'Los documentos patrimoniales y la planificación de beneficiarios parecen estar en orden.',
    'summary.estate.mid':
      'Algunos elementos de la planificación patrimonial están listos, pero podrían necesitar actualización.',
    'summary.estate.low':
      'Los documentos patrimoniales y las designaciones de beneficiarios necesitan atención.',
    'guidance.cashflow':
      'Un flujo de efectivo saludable es la base de todo plan financiero: crea flexibilidad para la protección, el ahorro y las metas de legado.',
    'guidance.emergency':
      'Un fondo de emergencia adecuado evita endeudarse por necesidad y protege las metas de largo plazo cuando surgen imprevistos.',
    'guidance.debt':
      'El manejo estratégico de la deuda libera flujo de efectivo para la protección y la creación de patrimonio a largo plazo.',
    'guidance.protection':
      'La planificación de la protección ayuda a que su familia mantenga su nivel de vida frente a los imprevistos de la vida.',
    'guidance.retirement':
      'El ahorro constante para el retiro se acumula con el tiempo: aumentos pequeños hoy pueden mejorar mucho el resultado.',
    'guidance.estate':
      'La planificación patrimonial asegura que sus bienes y sus deseos se respeten, y protege a su familia más allá de su vida.',
    'rec.cashflow.high1': 'Mantenga su disciplina de ahorro actual.',
    'rec.cashflow.high2':
      'Revise cada año las oportunidades de ahorro con ventajas fiscales.',
    'rec.cashflow.low1':
      'Arme un presupuesto mensual sencillo, enfocado en ahorrar de forma constante.',
    'rec.cashflow.low2': 'Automatice transferencias al ahorro el día de pago.',
    'rec.cashflow.ratio1':
      'Reduzca la carga de vivienda o aumente el ingreso donde sea posible.',
    'rec.cashflow.ratio2':
      'Registre sus gastos esenciales durante 30 días para identificar oportunidades de ahorro.',
    'rec.emergency.high1':
      'Mantenga 6 meses o más de gastos esenciales en reservas líquidas.',
    'rec.emergency.high2':
      'Revise cada año dónde está el fondo para confirmar que sigue siendo accesible.',
    'rec.emergency.low1':
      'Aumente sus reservas hasta llegar a 6 meses de gastos esenciales.',
    'rec.emergency.low2':
      'Mantenga el fondo de emergencia en cuentas líquidas y de fácil acceso.',
    'rec.emergency.lowMonths1':
      'Avance hacia 3 a 6 meses de gastos esenciales en un ahorro accesible.',
    'rec.emergency.lowMonths2':
      'Automatice transferencias mensuales para que el fondo crezca más rápido.',
    'rec.debt.high1':
      'Mantenga hábitos de pago disciplinados sin descuidar el ahorro de emergencia.',
    'rec.debt.high2':
      'Evite tomar deuda de alto interés para compras no esenciales.',
    'rec.debt.low1':
      'Priorice los saldos de mayor interés sin descuidar el ahorro de emergencia.',
    'rec.debt.low2':
      'Considere consolidar cuando las tasas y los plazos mejoren su flujo de efectivo.',
    'rec.protection.high1':
      'Revise cada año los beneficiarios y los montos de cobertura de sus pólizas.',
    'rec.protection.high2':
      'Confirme que la protección por discapacidad cubra los gastos esenciales del hogar.',
    'rec.protection.low1':
      'Compare su cobertura actual con la necesidad estimada de su hogar.',
    'rec.protection.low2':
      'Revise los beneficios en vida y los límites de cobertura de ambos generadores de ingreso.',
    'rec.protection.gap1': 'Atienda el Protection Gap™ estimado de {gap}.',
    'rec.protection.disabilityYes':
      'Revise los beneficios en vida y los límites de la cobertura por discapacidad de ambos generadores de ingreso.',
    'rec.protection.disabilityNo':
      'Agregue protección de ingresos por discapacidad para ayudar a proteger su sueldo.',
    'rec.protection.ok1':
      'Revise cada año los beneficiarios y los montos de cobertura de sus pólizas.',
    'rec.protection.ok2':
      'Confirme que la protección por discapacidad cubra los gastos esenciales del hogar.',
    'rec.retirement.high1':
      'Mantenga o aumente su tasa de aportación a medida que crezca su ingreso.',
    'rec.retirement.high2':
      'Revise la distribución de sus inversiones considerando su horizonte de tiempo.',
    'rec.retirement.low1':
      'Aumente las aportaciones para el retiro entre 1 % y 2 % del ingreso del hogar.',
    'rec.retirement.low2':
      'Revise si su empleador ofrece aportación equivalente y aprovéchela.',
    'rec.retirement.notSaving1':
      'Comience a aportar para el retiro mediante su empleador o una cuenta IRA.',
    'rec.retirement.notSaving2':
      'Automatice las aportaciones en cada periodo de pago, aunque sea un porcentaje modesto.',
    'rec.retirement.increase1':
      'Aumente las aportaciones para el retiro entre 1 % y 2 % del ingreso del hogar.',
    'rec.retirement.increase2':
      'Revise si su empleador ofrece aportación equivalente y aprovéchela.',
    'rec.estate.high1':
      'Revise sus documentos patrimoniales cada 3 a 5 años o después de un cambio importante de vida.',
    'rec.estate.high2':
      'Confirme las designaciones de beneficiarios en todas sus cuentas y pólizas.',
    'rec.estate.low1':
      'Actualice testamentos, fideicomisos y formularios de beneficiarios para reflejar sus deseos actuales.',
    'rec.estate.low2':
      'Confirme que las designaciones de beneficiarios coincidan con sus deseos actuales.',
    'rec.estate.children': 'Documente las preferencias de tutela para sus dependientes.',
    'rec.estate.noChildren':
      'Documente sus deseos de transferencia de bienes y los beneficiarios de sus cuentas principales.',
    'explanation.cashflow':
      'Su pago de vivienda representa el {ratio} del ingreso del hogar, y usted reportó "{cashFlowPhrase}".',
    'explanation.emergency':
      'Usted reportó {months} {monthWord} de gastos reservados en su ahorro de emergencia.',
    'explanation.debt':
      'Su deuda total es de {debt} frente a un ingreso del hogar de {income} (relación deuda-ingreso de {dti}).',
    'explanation.protection':
      'Según el ingreso, el estado civil y {children} {childWord} que usted reportó, la necesidad estimada de seguro de vida es de {need}. La cobertura actual es de {coverage} ({coverageRatio} de la necesidad estimada). Protección por discapacidad: {disability}.',
    'explanation.retirement': 'Usted reportó {contributionPhrase} para el retiro.',
    'explanation.retirementAge':
      'La edad de {age} años da contexto a su plazo de ahorro, pero su puntuación se basa en su comportamiento de aportación.',
    'explanation.estate':
      'Testamento: {will}. Fideicomiso: {trust}. Beneficiarios revisados: {beneficiaries}.',
    'explanation.estateGuardian': 'Preferencias de tutela documentadas: {guardian}.',
    'month.one': 'mes',
    'month.many': 'meses',
    'child.one': 'dependiente',
    'child.many': 'dependientes',
    'priority.protection.title': 'Cierre el Protection Gap™ de su familia',
    'priority.protection.why':
      'El seguro de vida y la cobertura por discapacidad que reportó podrían dejar un riesgo importante para su ingreso y su nivel de vida.',
    'priority.protection.impact':
      'Ayuda a proteger el ingreso, el nivel de vida y el legado de largo plazo de su familia si ocurre lo inesperado.',
    'priority.protection.timeline': 'Se recomienda dentro de 30 a 60 días',
    'priority.emergency.title': 'Fortalezca su fondo de emergencia',
    'priority.emergency.why':
      'Las reservas de emergencia que reportó podrían no cubrir una interrupción importante de ingreso o un gasto mayor.',
    'priority.emergency.impact':
      'Reduce la necesidad de endeudarse ante imprevistos y estabiliza la planificación de largo plazo.',
    'priority.emergency.timeline': 'Se recomienda dentro de 30 a 60 días',
    'priority.debt.title': 'Reduzca la presión de las deudas prioritarias',
    'priority.debt.why':
      'Su relación deuda-ingreso podría estar limitando su flujo de efectivo y su flexibilidad financiera.',
    'priority.debt.impact':
      'Libera flujo de efectivo mensual para la protección, el ahorro y las metas de legado.',
    'priority.debt.timeline': 'Se recomienda dentro de 60 a 90 días',
    'priority.estate.title': 'Complete la planificación patrimonial y de legado',
    'priority.estate.why':
      'Documentos patrimoniales clave o designaciones de beneficiarios parecen incompletos o desactualizados.',
    'priority.estate.impact':
      'Reduce la incertidumbre legal y asegura que sus bienes se transfieran conforme a sus deseos.',
    'priority.estate.timeline': 'Se recomienda dentro de 60 a 90 días',
    'priority.retirement.title': 'Acelere su preparación para el retiro',
    'priority.retirement.why':
      'El nivel de aportación para el retiro que reportó podría no sostener sus metas de independencia a largo plazo.',
    'priority.retirement.impact':
      'Genera impulso hacia la independencia financiera y el estatus Legacy Ready™.',
    'priority.retirement.timeline': 'Se recomienda durante los próximos 6 a 12 meses',
    'priority.cashflow.title': 'Mejore su flujo de efectivo mensual',
    'priority.cashflow.why':
      'La carga de vivienda o los hábitos de gasto podrían estar limitando su capacidad de ahorrar y de proteger su ingreso.',
    'priority.cashflow.impact':
      'Crea flexibilidad mensual para financiar la protección, las reservas y las metas de largo plazo.',
    'priority.cashflow.timeline': 'Se recomienda dentro de 30 a 60 días',
    'priority.whyScore': ' (puntuación de {title}: {score}/100).',
    'level.critical': 'Revisión crítica',
    'level.important': 'Importante',
    'level.longTerm': 'Largo plazo',
    'foundation.legacy_ready': 'Camino a Legacy Ready™',
    'foundation.strong': 'Base sólida',
    'foundation.momentum': 'Ganando impulso',
    'foundation.stabilizing': 'Etapa de estabilización',
    'foundation.attention': 'Requiere atención inmediata',
    'narrative.high':
      '{prefix} financiero de su familia muestra fundamentos sólidos, con oportunidades puntuales para llegar a ser Legacy Ready™.',
    'narrative.mid':
      '{prefix} financiero de su familia tiene una base funcional, pero varias categorías necesitan atención para mejorar la estabilidad de largo plazo.',
    'narrative.low':
      '{prefix} financiero de su familia muestra vulnerabilidades importantes que conviene atender pronto.',
    'narrative.prefixNamed': '{name}, el perfil',
    'narrative.prefixGeneric': 'El perfil',
    'blueprint.protection': 'Proteger el ingreso',
    'blueprint.emergency': 'Crear un fondo de emergencia',
    'blueprint.debt': 'Eliminar deudas innecesarias',
    'blueprint.retirement': 'Prepararse para el retiro',
    'blueprint.cashflow': 'Fortalecer el flujo de efectivo mensual',
    'blueprint.estate': 'Crear un plan patrimonial',
    'blueprint.wealth': 'Construir patrimonio generacional',
    'action.meetStrategist': 'Reúnase con un estratega financiero de Valtoris',
    'action.reviewBeneficiaries':
      'Revise los beneficiarios de todas sus pólizas y cuentas.',
    'action.reviewGap': 'Revise con un asesor su Protection Gap™ de {gap}.',
    'action.college':
      'Revise las metas de financiamiento educativo para sus dependientes.',
    'action.annualPlan': 'Actualice el plan financiero anual de su familia',
    'action.highestRisk': 'Atienda la categoría financiera de mayor riesgo.',
    'action.emergencyMomentum': 'Genere impulso en su ahorro de emergencia.',
    'action.debtOrSavings': 'Cree un plan de acción para deudas o ahorro.',
    'action.retirementTarget': 'Revise sus metas de aportación para el retiro.',
    'action.willTrust': 'Complete la planificación de testamento y fideicomiso.',
    'action.wealth':
      'Revise sus prioridades de creación de patrimonio a largo plazo.',
    'status.strength': 'Riesgo bajo',
    'status.opportunity': 'Riesgo moderado',
    'status.neutral': 'Requiere atención',
    'chrome.currentScore': 'Puntuación actual',
    'chrome.letterGrade': 'Calificación con letra',
    'chrome.atAGlance': 'Un panorama general',
    'chrome.insightsTitle': 'Fortalezas y oportunidades',
    'chrome.insightsLead':
      'Dónde su familia está más fuerte hoy y dónde están las mejoras de mayor impacto.',
    'chrome.greatestStrengths': 'Mayores fortalezas',
    'chrome.biggestOpportunities': 'Mayores oportunidades',
    'chrome.protectionTitle': 'Análisis de protección',
    'chrome.protectionLead':
      'Qué tan bien su cobertura actual protege el ingreso y el nivel de vida de su familia.',
    'chrome.immediate': 'Inmediato',
    'chrome.thirtyDays': '30 días',
    'chrome.ninetyDays': '90 días',
    'chrome.whyThisMatters': 'Por qué importa',
    'chrome.recommendedTimeline': 'Plazo recomendado',
    'chrome.priorityRank': 'Prioridad n.º {rank}',
    'hero.progressLabel': 'Avance hacia Legacy Ready™',
    'hero.progressCopy':
      'Mide qué tan preparada está su familia para proteger el ingreso, crear patrimonio y llegar a ser Legacy Ready™.',
    'hero.gapLabel': 'Protection Gap™',
    'hero.gapCopy':
      'Protección adicional estimada que su familia podría necesitar más allá de la cobertura actual.',
    'protection.label': 'Protection Gap™ familiar',
    'protection.note':
      'Cerrar esta brecha ayuda a proteger el ingreso, el nivel de vida y las metas de legado de su familia.',
    'fallback.strength': 'Evaluación financiera completada',
    'fallback.opportunity': 'Siga fortaleciendo su base financiera',
  },
}

export const familyCopy: SpecializedProductCopy = {
  en: FAMILY_COPY_EN,
  es: FAMILY_COPY_ES,
}
