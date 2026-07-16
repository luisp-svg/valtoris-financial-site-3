import DiagnosticLanding from '../components/home/DiagnosticLanding'
import ProtectionSampleResultsPreview from '../components/home/ProtectionSampleResultsPreview'
import { PROTECTION_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Recommended Coverage',
    description: 'An estimated life insurance amount designed to help protect your household.',
  },
  {
    icon: 'protection' as const,
    title: 'Protection Gap',
    description: 'The difference between what your family may need and what you already have.',
  },
  {
    icon: 'priorities' as const,
    title: 'Needs Analysis',
    description: 'A clear breakdown across income, housing, debt, education, and final expenses.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Action Recommendations',
    description: 'Focused next steps so you know where protection planning should begin.',
  },
]

const CATEGORIES = [
  {
    icon: 'cashflow' as const,
    title: 'Income Protection',
    description: 'Replacement income to help your family maintain their standard of living.',
  },
  {
    icon: 'emergency' as const,
    title: 'Mortgage / Rent Protection',
    description: 'Housing payment support to preserve stability at home.',
  },
  {
    icon: 'debt' as const,
    title: 'Debt Payoff',
    description: 'Outstanding consumer debt and liabilities your family would inherit.',
  },
  {
    icon: 'estate' as const,
    title: 'Child Education',
    description: 'Future education funding considerations for each child in your household.',
  },
  {
    icon: 'session' as const,
    title: 'Final Expenses',
    description: 'End-of-life costs so your family is not burdened unexpectedly.',
  },
  {
    icon: 'credit' as const,
    title: 'Existing Coverage',
    description: 'Current life insurance applied as a deduction from total need.',
  },
  {
    icon: 'protection' as const,
    title: 'Protection Gap™',
    description: 'The remaining difference between estimated need and current coverage.',
  },
  {
    icon: 'strategy' as const,
    title: 'Coverage Recommendation',
    description: 'A clear total estimate of protection that may be appropriate for your family.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Share focused details about income, housing, debt, education, and coverage.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get recommended coverage, a needs breakdown, and your estimated Protection Gap™.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See which protection priorities deserve attention first.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your analysis in a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does the Family Protection Analysis take?',
    answer: 'Most households finish in under two minutes.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Valtoris Family Protection Analysis™ is complimentary and educational.',
  },
  {
    question: 'Are the estimates guaranteed?',
    answer:
      'No. Results are educational estimates based on your answers. They do not guarantee coverage amounts, underwriting outcomes, or product availability.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. You can review your results with no purchase required.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you choose to schedule a follow-up conversation. Completing the analysis alone does not create a sales commitment.',
  },
  {
    question: 'Is my information secure?',
    answer:
      'Your answers are used to generate your protection estimate and are handled with care for educational planning purposes.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. Retake the analysis anytime your income, coverage, or family situation changes.',
  },
]

export default function ProtectionAnalysisPage() {
  return (
    <DiagnosticLanding
      pageClassName="protection-analysis-page"
      eyebrow="VALTORIS FAMILY PROTECTION ANALYSIS™"
      title="Is Your Family Financially Protected?"
      heroCopies={[
        'Take the complimentary Valtoris Family Protection Analysis™ to evaluate income replacement, housing protection, debt payoff, education funding, final expenses, and your current life insurance coverage.',
        'See your estimated Protection Gap™, what may leave your household exposed, and what to address next.',
      ]}
      ctaLabel={PROTECTION_CTA}
      ctaTo={ROUTES.protectionGap}
      heroMicrocopy="Takes under two minutes. No cost. No obligation. Results are estimates, not guarantees."
      receiveLead="Four deliverables that turn a short calculator into clearer protection direction."
      receiveItems={WHAT_YOU_RECEIVE}
      sampleLead="An illustrative look at coverage need, current coverage, Protection Gap™, and priority recommendations."
      samplePreview={<ProtectionSampleResultsPreview />}
      categoriesHeading="Categories Evaluated"
      categoriesLead="Your Protection Analysis reviews the planning inputs that shape estimated coverage need."
      categories={CATEGORIES}
      howLead="From your first answers to a clearer next step in four focused stages."
      howSteps={HOW_IT_WORKS}
      faqs={FAQS}
      closingTitle="Know Your Gap Before It Becomes a Risk"
      closingCopy="Start with a focused protection estimate and leave with clearer next-step direction."
      closingMicrocopy="Takes under two minutes. No cost. No obligation. Results are estimates, not guarantees."
    />
  )
}
