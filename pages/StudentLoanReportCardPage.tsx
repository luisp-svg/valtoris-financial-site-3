import { useLocation } from 'react-router-dom'
import DiagnosticLanding from '../components/home/DiagnosticLanding'
import { STUDENT_LOAN_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'
import { readSpecializedLocale, withSpecializedLocale } from '../components/assessment/specialized/locale'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Student Loan Health Score',
    description:
      'A future 0–100 score and letter grade that summarize loan status, repayment strategy, and review priorities. Scoring is not available in this foundation release.',
  },
  {
    icon: 'priorities' as const,
    title: 'Review Flags and Top Areas',
    description:
      'Critical situations such as default or delinquency will be listed separately from the numeric score once scoring ships.',
  },
  {
    icon: 'strategy' as const,
    title: 'Goal-Aligned Next Step',
    description:
      'Your primary goal and urgency will frame a later advisor review. This is educational, not an eligibility determination.',
  },
  {
    icon: 'session' as const,
    title: 'Optional Strategy Conversation',
    description:
      'When results are available, you can optionally review them in a complimentary conversation. Nothing is created automatically today.',
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
    description: 'Repayment, deferment, delinquency, or default status that later scoring can weight carefully.',
  },
  {
    icon: 'strategy' as const,
    title: 'Repayment Strategy',
    description: 'Whether you know your plan, using a maintainable program list rather than a database enum.',
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
    title: 'Results Come Next',
    description: 'A score, grade, and flags will appear in a later phase. This release does not invent those numbers.',
  },
  {
    step: '4',
    title: 'Optional Review',
    description: 'When scoring exists, you will be able to book a complimentary review. No Opportunity is created automatically.',
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
      'Not yet. This foundation collects answers and acknowledgments only. Scoring and CRM submission ship in a later phase.',
  },
  {
    question: 'Is this an eligibility or forgiveness approval?',
    answer:
      'No. This is an educational diagnostic. It does not determine eligibility, payment amounts, forgiveness, or savings.',
  },
  {
    question: 'Will someone contact me automatically?',
    answer:
      'Only if you later submit through the official ingest path and grant contact permission. Completing these questions today does not create a CRM lead.',
  },
]

function StudentLoanSamplePreview() {
  return (
    <article className="platform-card funnel-preview-card">
      <p className="platform-eyebrow">Architecture preview</p>
      <h3 className="diagnostic-receive-title">Results will include</h3>
      <ul className="diagnostic-faq-answer">
        <li>Student Loan Health Score and grade (not calculated yet)</li>
        <li>Category scores and critical flags (not calculated yet)</li>
        <li>Top three review areas and your primary goal</li>
        <li>An optional booking next step</li>
      </ul>
      <p className="funnel-microcopy">No sample score or letter grade is shown because scoring is not implemented.</p>
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
        'This foundation release collects your answers. A score and review flags will be added in a later phase — nothing is invented today.',
      ]}
      ctaLabel={STUDENT_LOAN_CTA}
      ctaTo={assessmentTo}
      heroMicrocopy="10 diagnostic questions. No FSA login. No Social Security number. No cost to start."
      receiveLead="What this specialized Report Card is being built to deliver."
      receiveItems={WHAT_YOU_RECEIVE}
      sampleLead="A structural look at the results layout. No fabricated score is shown."
      samplePreview={<StudentLoanSamplePreview />}
      categoriesHeading="What the 10 Questions Cover"
      categoriesLead="Each group counts as one diagnostic question, including grouped follow-ups."
      categories={CATEGORIES}
      howLead="From your first answers to a later scored report — without creating a CRM Opportunity automatically."
      howSteps={HOW_IT_WORKS}
      faqs={FAQS}
      closingTitle="Ready to Start Your Student Loan Report Card™?"
      closingCopy="Answer 10 focused questions. Results scoring and CRM submission are not enabled in this foundation release."
      closingMicrocopy="No account numbers. No FSA credentials. Required privacy acknowledgments stay explicit."
    />
  )
}
