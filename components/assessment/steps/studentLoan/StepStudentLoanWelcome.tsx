import QuestionCard from '../../QuestionCard'
import { STUDENT_LOAN_CTA } from '../../../../constants/homepage'
import type { SpecializedCopyFn } from '../../specialized/renderer'

type StepStudentLoanWelcomeProps = {
  t: SpecializedCopyFn
  onBegin: () => void
  onBack?: () => void
}

export default function StepStudentLoanWelcome({ t, onBegin, onBack }: StepStudentLoanWelcomeProps) {
  return (
    <QuestionCard title={t('ui', 'welcomeTitle')} description={t('ui', 'welcomeBody')}>
      <p className="funnel-microcopy assessment-note">{t('ui', 'welcomeNote')}</p>
      <div className="welcome-actions">
        <button type="button" className="platform-btn platform-btn-primary" onClick={onBegin}>
          {STUDENT_LOAN_CTA}
        </button>
        {onBack ? (
          <button type="button" className="platform-btn platform-btn-outline" onClick={onBack}>
            {t('ui', 'backToOverview')}
          </button>
        ) : null}
      </div>
    </QuestionCard>
  )
}
