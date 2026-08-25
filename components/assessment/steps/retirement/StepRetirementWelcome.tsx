import QuestionCard from '../../QuestionCard'
import type { ReportCardCopyFn } from '../../reportCardLocale'

type StepRetirementWelcomeProps = {
  t: ReportCardCopyFn
  onBegin: () => void
  onBack?: () => void
}

export default function StepRetirementWelcome({
  t,
  onBegin,
  onBack,
}: StepRetirementWelcomeProps) {
  return (
    <QuestionCard title={t('ui', 'welcomeTitle')} description={t('helpers', 'welcome')}>
      <p className="funnel-microcopy assessment-note">{t('helpers', 'welcomeNote')}</p>
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
