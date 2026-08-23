import { useLocation } from 'react-router-dom'
import DiagnosticLanding from '../components/home/DiagnosticLanding'
import { STUDENT_LOAN_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'
import { readSpecializedLocale, withSpecializedLocale } from '../components/assessment/specialized/locale'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Student Loan Report Card Score',
    description:
      'A 0–100 Valtoris Student Loan Report Card Score and letter grade that summarize loan status, repayment strategy, and review priorities. Large balances are not penalized.',
  },
  {
    icon: 'priorities' as const,
    title: 'Review Flags and Top Areas',
    description:
      'Critical situations such as default or delinquency appear as review flags, separately from the numeric score.',
  },
  {
    icon: 'strategy' as const,
    title: 'Goal-Aligned Next Step',
    description:
      'Your primary goal and urgency frame the recommended review. This is educational, not an eligibility determination.',
  },
  {
    icon: 'session' as const,
    title: 'Optional Strategy Conversation',
    description:
      'You can optionally review your results in a complimentary conversation. Completing the assessment does not create a CRM Opportunity.',
  },
]

const CATEGORIES = [
  {
    icon: 'picture' as const,
    title: 'Loan Structure',
    description: 'Loan types, balance range, and servicer awareness — without account numbers or FSA credentials.',
  },
  {
    icon: 'credit' as const,
    title: 'Status and Stability',
    description: 'Repayment, deferment, delinquency, or default status, weighted for stability — not loan size.',
  },
  {
    icon: 'strategy' as const,
    title: 'Repayment Strategy',
    description:
      'Whether you know your current or recent repayment plan, using current federal plan names plus legacy options borrowers may still report.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Income and Household',
    description: 'Income band and household size for later income-driven review context.',
  },
  {
    icon: 'independence' as const,
    title: 'Employment Context',
    description: 'Government, nonprofit, private, self-employed, or not employed — plus tenure when relevant.',
  },
  {
    icon: 'emergency' as const,
    title: 'Payment History',
    description: 'Recent payment pattern and whether payments are currently paused.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer 10 Questions',
    description: 'Share loan, payment, and goal details. Contact information is collected after the diagnostic.',
  },
  {
    step: '2',
    title: 'Acknowledge Privacy',
    description: 'Required storage and privacy acknowledgments use the existing public consent controls.',
  },
  {
    step: '3',
    title: 'See Your Results',
    description: 'Your score, grade, flags, and top review areas are calculated from your answers on this device.',
  },
  {
    step: '4',
    title: 'Optional Review',
    description: 'Book a complimentary review if you want to walk through the results. No Opportunity is created automatically.',
  },
]

const FAQS = [
  {
    question: 'How long does the Student Loan Report Card take?',
    answer: 'Most people finish the 10 diagnostic questions plus contact details in a few minutes.',
  },
  {
    question: 'Will you ask for my FSA login or Social Security number?',
    answer: 'No. We never collect SSN, date of birth, FSA credentials, loan account numbers, or document uploads.',
  },
  {
    question: 'Do I get a score today?',
    answer:
      'Yes. You receive a Valtoris Student Loan Report Card Score, grade, flags, and review areas after the 10 questions and acknowledgments.',
  },
  {
    question: 'Is this an eligibility or forgiveness approval?',
    answer:
      'No. This is an educational diagnostic. It does not determine eligibility, payment amounts, forgiveness, or savings.',
  },
  {
    question: 'Will someone contact me automatically?',
    answer:
      'No automatic messages are sent. If you finish the assessment and agree to be contacted, Valtoris may follow up about your results. Completing the questions does not enroll you in a federal program.',
  },
]

function StudentLoanSamplePreview() {
  return (
    <article className="platform-card funnel-preview-card">
      <p className="platform-eyebrow">What you will see</p>
      <h3 className="diagnostic-receive-title">Your results include</h3>
      <ul className="diagnostic-faq-answer">
        <li>Student Loan Report Card Score and letter grade</li>
        <li>Category scores and critical review flags</li>
        <li>Up to three review areas and your primary goal</li>
        <li>An optional complimentary review next step</li>
      </ul>
      <p className="funnel-microcopy">No sample score or letter grade is invented on this page.</p>
    </article>
  )
}

export default function StudentLoanReportCardPage() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  const assessmentTo = withSpecializedLocale(ROUTES.studentLoanAssessment, locale)

  return (
    <DiagnosticLanding
      pageClassName="student-loan-report-card-page"
      eyebrow="VALTORIS STUDENT LOAN REPORT CARD™"
      title="Get Clarity on Your Student Loans"
      heroCopies={[
        'Take the Valtoris Student Loan Report Card™ to organize your loan types, status, repayment plan, income, and goals.',
        'See a Valtoris Student Loan Report Card Score, review flags, and next-step areas. Results are educational and are not a government determination.',
      ]}
      ctaLabel={STUDENT_LOAN_CTA}
      ctaTo={assessmentTo}
      heroMicrocopy="10 diagnostic questions. No FSA login. No Social Security number. No cost to start."
      receiveLead="What this specialized Report Card delivers after 10 questions."
      receiveItems={WHAT_YOU_RECEIVE}
      sampleLead="A structural look at the results layout. No fabricated score is shown."
      samplePreview={<StudentLoanSamplePreview />}
      categoriesHeading="What the 10 Questions Cover"
      categoriesLead="Each group counts as one diagnostic question, including grouped follow-ups."
      categories={CATEGORIES}
      howLead="From your first answers to a scored report — without creating a CRM Opportunity automatically."
      howSteps={HOW_IT_WORKS}
      faqs={FAQS}
      closingTitle="Ready to Start Your Student Loan Report Card™?"
      closingCopy="Answer 10 focused questions and receive your Valtoris Student Loan Report Card Score."
      closingMicrocopy="No account numbers. No FSA credentials. Required privacy acknowledgments stay explicit."
    />
  )
}
