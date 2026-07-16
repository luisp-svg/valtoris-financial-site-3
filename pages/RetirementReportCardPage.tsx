import DiagnosticLanding from '../components/home/DiagnosticLanding'
import RetirementSampleResultsPreview from '../components/home/RetirementSampleResultsPreview'
import { RETIREMENT_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Retirement Readiness Score',
    description:
      'An overall score and letter grade that summarizes how prepared your plan appears today.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Income-Gap Analysis',
    description:
      'A clear view of projected retirement spending need versus expected income sources.',
  },
  {
    icon: 'retirement' as const,
    title: 'Category-by-Category Review',
    description:
      'Eight retirement categories scored so you can see strengths and gaps side by side.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Personalized Action Blueprint',
    description:
      'Immediate, 30-day, and 90-day priorities tailored to your answers and timeline.',
  },
]

const CATEGORIES = [
  {
    icon: 'picture' as const,
    title: 'Retirement Vision & Timeline',
    description: 'Clarify lifestyle goals, plan clarity, and your intended retirement date.',
  },
  {
    icon: 'retirement' as const,
    title: 'Savings & Contribution Progress',
    description: 'Evaluate balances, contribution habits, and employer-match utilization.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Retirement Income Sources',
    description: 'Review Social Security, pension, annuity, and other expected income streams.',
  },
  {
    icon: 'strategy' as const,
    title: 'Income Adequacy & Sustainability',
    description: 'Compare projected income to spending need under standard planning assumptions.',
  },
  {
    icon: 'credit' as const,
    title: 'Investment Risk & Diversification',
    description: 'Assess risk posture, diversification, and allocation review habits.',
  },
  {
    icon: 'independence' as const,
    title: 'Tax Diversification & Efficiency',
    description: 'Look at account types, Roth usage, and tax-planning readiness.',
  },
  {
    icon: 'emergency' as const,
    title: 'Healthcare & Long-Term-Care Readiness',
    description: 'Check Medicare readiness, HSA balances, and long-term-care planning.',
  },
  {
    icon: 'estate' as const,
    title: 'Estate, Beneficiaries & Legacy',
    description: 'Review wills, trusts, powers of attorney, beneficiaries, and legacy intent.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Share focused details about your timeline, savings, income, and protection.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get your retirement score, grade, and category breakdown immediately.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See what appears on track, where gaps may exist, and what to prioritize next.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your results in a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does the Retirement Report Card take?',
    answer: 'Most people finish in about 4–6 minutes. No account creation is required.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Valtoris Retirement Report Card™ is complimentary with no obligation.',
  },
  {
    question: 'Are the projections guaranteed?',
    answer:
      'No. Results are educational estimates based on your answers and standard planning assumptions. They do not guarantee retirement outcomes.',
  },
  {
    question: 'Do I need exact account balances?',
    answer:
      'Approximate figures are fine. More accurate inputs produce more useful estimates, but you can refine details later.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. You receive your results whether or not you choose to take a next step.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you provide contact preferences and consent. Completing the report card alone does not create a sales commitment.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. You can retake the assessment anytime your situation changes.',
  },
]

export default function RetirementReportCardPage() {
  return (
    <DiagnosticLanding
      pageClassName="retirement-report-card-page"
      eyebrow="VALTORIS RETIREMENT REPORT CARD™"
      title="Are You on Track to Retire With Confidence?"
      heroCopies={[
        'Take the Valtoris Retirement Report Card™ to evaluate your retirement income, savings progress, Social Security, pension decisions, investment risk, tax diversification, healthcare readiness, and legacy planning.',
        'See what appears to be on track, where important gaps may exist, and what to address next.',
      ]}
      ctaLabel={RETIREMENT_CTA}
      ctaTo={ROUTES.retirementAssessment}
      heroMicrocopy="Takes approximately 4–6 minutes. No cost. No obligation. Results are estimates, not guarantees."
      receiveLead="Four deliverables designed to turn a short assessment into clearer retirement direction."
      receiveItems={WHAT_YOU_RECEIVE}
      sampleLead="An illustrative look at the score, category detail, and action plan you can expect."
      samplePreview={<RetirementSampleResultsPreview />}
      categoriesHeading="Eight Retirement Categories"
      categoriesLead="Your Report Card reviews the eight areas that shape a coordinated retirement foundation."
      categories={CATEGORIES}
      howLead="From your first answers to a clearer next step in four focused stages."
      howSteps={HOW_IT_WORKS}
      faqs={FAQS}
      closingTitle="Ready to See Where Your Retirement Stands?"
      closingCopy="Take the first step and receive a clearer picture of your score, income gap, and next priorities."
      closingMicrocopy="Takes approximately 4–6 minutes. No cost. No obligation. Results are estimates, not guarantees."
    />
  )
}
