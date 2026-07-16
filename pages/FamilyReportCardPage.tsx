import DiagnosticLanding from '../components/home/DiagnosticLanding'
import SampleResultsPreview from '../components/home/SampleResultsPreview'
import { FAMILY_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Overall Financial Score',
    description: 'A clear household score and letter grade that shows where you stand today.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Personalized Category Scores',
    description: 'Category-by-category results so you can see strengths and weak spots side by side.',
  },
  {
    icon: 'protection' as const,
    title: 'Risk Analysis',
    description: 'A focused view of where your family may be financially exposed.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Action Blueprint',
    description: 'Immediate, 30-day, and 90-day priorities tailored to your answers.',
  },
]

const CATEGORIES = [
  {
    icon: 'cashflow' as const,
    title: 'Cash Flow and Budget',
    description: 'See how income, spending, and monthly flexibility support your goals.',
  },
  {
    icon: 'emergency' as const,
    title: 'Emergency Preparedness',
    description: 'Evaluate whether reserves can cover unexpected expenses or income disruption.',
  },
  {
    icon: 'debt' as const,
    title: 'Debt Management',
    description: 'Understand how balances and payments may be limiting progress.',
  },
  {
    icon: 'protection' as const,
    title: 'Protection and Insurance',
    description: 'Identify where coverage may leave your household exposed.',
  },
  {
    icon: 'retirement' as const,
    title: 'Retirement Readiness',
    description: 'Check whether current savings habits align with long-term income needs.',
  },
  {
    icon: 'estate' as const,
    title: 'Estate and Legacy Planning',
    description: 'Review wills, trusts, and documents that protect the people you love.',
  },
  {
    icon: 'credit' as const,
    title: 'Credit Health',
    description: 'Assess credit strength and how it affects borrowing and opportunity.',
  },
  {
    icon: 'independence' as const,
    title: 'Financial Independence',
    description: 'Measure progress toward lasting freedom and family financial resilience.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Complete a focused set of household finance questions in about two minutes.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get your score, grade, and category breakdown immediately after finishing.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See what is working, what may be exposed, and what to prioritize next.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your results in a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does the Family Report Card take?',
    answer: 'Most families finish in about two minutes. No account creation is required.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Valtoris Family Financial Report Card™ is complimentary with no obligation.',
  },
  {
    question: 'Are the results guaranteed?',
    answer:
      'No. Results are educational estimates based on your answers. They do not guarantee financial outcomes.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. You receive your results whether or not you choose to take a next step.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you choose to continue with a strategy conversation. Completing the report card alone does not create a sales commitment.',
  },
  {
    question: 'Is my information secure?',
    answer:
      'Your answers are used to generate your personalized results and are handled with care for educational planning purposes.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. You can retake the assessment anytime your situation changes.',
  },
]

export default function FamilyReportCardPage() {
  return (
    <DiagnosticLanding
      pageClassName="family-report-card-page"
      eyebrow="VALTORIS FAMILY FINANCIAL REPORT CARD™"
      title="How Financially Prepared Is Your Family?"
      heroCopies={[
        'Take the complimentary 2-minute Valtoris Family Financial Report Card™ to evaluate cash flow, emergency reserves, debt, protection, retirement readiness, estate planning, credit, and financial independence.',
        'See what appears to be working, where your family may be exposed, and what to address next.',
      ]}
      ctaLabel={FAMILY_CTA}
      ctaTo={ROUTES.familyAssessment}
      heroMicrocopy="Takes approximately two minutes. No cost. No obligation. Results are estimates, not guarantees."
      receiveLead="Four deliverables designed to turn a short assessment into clear financial direction."
      receiveItems={WHAT_YOU_RECEIVE}
      sampleLead="An illustrative look at the score, category detail, and action plan you can expect."
      samplePreview={<SampleResultsPreview />}
      categoriesHeading="Categories Evaluated"
      categoriesLead="Your Report Card reviews the eight areas that shape a coordinated family financial foundation."
      categories={CATEGORIES}
      howLead="From your first answers to a clearer next step in four focused stages."
      howSteps={HOW_IT_WORKS}
      faqs={FAQS}
      closingTitle="Ready to See Where Your Family Stands?"
      closingCopy="Take the first step and receive a clearer picture of your score, risks, and next priorities."
      closingMicrocopy="Takes approximately two minutes. No cost. No obligation. Results are estimates, not guarantees."
    />
  )
}
