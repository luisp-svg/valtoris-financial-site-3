import QuestionCard from '../../QuestionCard'
import type { SpecializedCopyFn } from '../../specialized/renderer'

type StepCreditWelcomeProps = {
  t: SpecializedCopyFn
  onBegin: () => void
  onBack?: () => void
}

export default function StepCreditWelcome({ t, onBegin, onBack }: StepCreditWelcomeProps) {
  return (
    <QuestionCard title={t('ui', 'welcomeTitle')} description={t('ui', 'welcomeBody')}>
      <p className="funnel-microcopy assessment-note">{t('ui', 'welcomeNote')}</p>
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
