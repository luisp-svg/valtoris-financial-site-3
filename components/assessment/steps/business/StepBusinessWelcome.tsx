import QuestionCard from '../../QuestionCard'
import type { ReportCardCopyFn } from '../../reportCardLocale'

type StepBusinessWelcomeProps = {
  onBegin: () => void
  onBack?: () => void
  t: ReportCardCopyFn
}

export default function StepBusinessWelcome({ onBegin, onBack, t }: StepBusinessWelcomeProps) {
  return (
    <QuestionCard title={t('ui', 'welcomeTitle')} description={t('ui', 'welcomeBody')}>
      <div className="welcome-actions">
        <button type="button" className="platform-btn platform-btn-primary" onClick={onBegin}>
          {t('ui', 'startCta')}
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
