import BusinessSampleResultsPreview from '../components/home/BusinessSampleResultsPreview'
import DiagnosticLanding from '../components/home/DiagnosticLanding'
import { BUSINESS_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Business Score',
    description: 'An overall business financial score and letter grade across core operating areas.',
  },
  {
    icon: 'protection' as const,
    title: 'Business Risk Review',
    description: 'A clear view of continuity, coverage, and exposure that may threaten the company.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Owner Strategy Blueprint',
    description:
      "Guidance that connects company strength with the owner's long-term financial position.",
  },
  {
    icon: 'priorities' as const,
    title: '90-Day Business Priorities',
    description: 'Focused near-term actions so leadership knows what to address first.',
  },
]

const CATEGORIES = [
  {
    icon: 'picture' as const,
    title: 'Business Structure',
    description: 'Legal entity, operating documents, and separation of personal and business finances.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Cash Flow',
    description: 'Operating cash flow, reserves, revenue predictability, and owner compensation.',
  },
  {
    icon: 'strategy' as const,
    title: 'Tax Strategy',
    description: 'Proactive tax planning, benefit strategies, and alignment with growth goals.',
  },
  {
    icon: 'protection' as const,
    title: 'Business Protection',
    description: 'Key person coverage, buy-sell planning, and leadership continuity strategies.',
  },
  {
    icon: 'emergency' as const,
    title: 'Risk Management',
    description: 'Commercial insurance, specialized coverage, and operational liability exposure.',
  },
  {
    icon: 'retirement' as const,
    title: 'Retirement & Wealth',
    description: 'Owner retirement savings outside the business relative to income and revenue.',
  },
  {
    icon: 'credit' as const,
    title: 'Credit & Funding',
    description: 'Business credit profile, lending relationships, and access to growth capital.',
  },
  {
    icon: 'independence' as const,
    title: 'Exit Planning',
    description: 'Succession planning, valuation baseline, and long-term transition readiness.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Share focused details about your business operations, protection, and owner goals.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get your business score, grade, and category breakdown immediately.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See where the business is strong, exposed, and what deserves attention first.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your results with a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does the Business Report Card take?',
    answer: 'Most business owners complete the assessment in a few focused minutes.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Valtoris Business Financial Report Card™ is complimentary with no obligation.',
  },
  {
    question: 'Are the results guaranteed?',
    answer:
      'No. Results are educational estimates based on your answers. They do not guarantee business or financial outcomes.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. Your results are provided whether or not you choose additional services.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you request a follow-up conversation. Completing the report card alone does not create a sales commitment.',
  },
  {
    question: 'Is my information secure?',
    answer:
      'Your answers are used to generate personalized business results and are handled with care for educational planning purposes.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. Retake the assessment as your business, team, or goals evolve.',
  },
]

export default function BusinessReportCardPage() {
  return (
    <DiagnosticLanding
      pageClassName="business-report-card-page"
      eyebrow="VALTORIS BUSINESS FINANCIAL REPORT CARD™"
      title="How Financially Prepared Is Your Business?"
      heroCopies={[
        'Take the complimentary Valtoris Business Financial Report Card™ to evaluate structure, cash flow, tax strategy, protection, risk management, owner retirement readiness, credit, and exit planning.',
        'See where the business appears strong, where important gaps may exist, and what to address next.',
      ]}
      ctaLabel={BUSINESS_CTA}
      ctaTo={ROUTES.businessAssessment}
      heroMicrocopy="Takes a few focused minutes. No cost. No obligation. Results are estimates, not guarantees."
      receiveLead="Four deliverables that turn a short diagnostic into clear business direction."
      receiveItems={WHAT_YOU_RECEIVE}
      sampleLead="An illustrative look at the score, category detail, and action plan business owners can expect."
      samplePreview={<BusinessSampleResultsPreview />}
      categoriesHeading="Categories Evaluated"
      categoriesLead="Your Business Report Card reviews the eight dimensions that shape company financial health."
      categories={CATEGORIES}
      howLead="From your first answers to a clearer next step in four focused stages."
      howSteps={HOW_IT_WORKS}
      faqs={FAQS}
      closingTitle="Ready to See Where Your Business Stands?"
      closingCopy="Take the first step and receive a clearer picture of business strength, risk, and near-term priorities."
      closingMicrocopy="Takes a few focused minutes. No cost. No obligation. Results are estimates, not guarantees."
    />
  )
}
