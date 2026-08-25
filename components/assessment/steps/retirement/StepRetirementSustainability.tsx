import ChoiceGroup from '../../ChoiceGroup'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  RETIREMENT_GOAL_OPTIONS,
  RETIREMENT_PROJECTION_ASSUMPTIONS,
  YES_NO_UNSURE_OPTIONS,
} from '../../retirement/constants'
import {
  RetirementGoalsAnswers,
  RetirementIncomeSourceAnswers,
} from '../../retirement/types'

type StepRetirementSustainabilityProps = {
  t: ReportCardCopyFn
  goals: RetirementGoalsAnswers
  incomeSources: RetirementIncomeSourceAnswers
  onGoalsChange: (selected: string[]) => void
  onIncomeSourcesChange: (field: keyof RetirementIncomeSourceAnswers, value: string) => void
}

const MAX_GOALS = 3

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed((rate * 100) % 1 === 0 ? 0 : 1)}%`
}

export default function StepRetirementSustainability({
  t,
  goals,
  incomeSources,
  onGoalsChange,
  onIncomeSourcesChange,
}: StepRetirementSustainabilityProps) {
  function handleGoalsChange(selected: string[]) {
    if (selected.length <= MAX_GOALS) {
      onGoalsChange(selected)
      return
    }
    onGoalsChange(selected.slice(-MAX_GOALS))
  }

  return (
    <QuestionCard title={t('ui', 'step6Title')} description={t('helpers', 'step6')}>
      <div className="retirement-assumption-list" aria-label={t('fields', 'assumptionsHeading')}>
        <h3 className="assessment-section-heading">{t('fields', 'assumptionsHeading')}</h3>
        <ul>
          <li>
            {t('results', 'assumption.inflation')}:{' '}
            {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.inflation)}
          </li>
          <li>
            {t('results', 'assumption.preRetirementGrowth')}:{' '}
            {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.preRetirementGrowth)}
          </li>
          <li>
            {t('results', 'assumption.retirementReturn')}:{' '}
            {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.retirementReturn)}
          </li>
          <li>
            {t('results', 'assumption.withdrawalRate')}:{' '}
            {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.withdrawalRate)}
          </li>
          <li>
            {t('results', 'assumption.longevityAge')}:{' '}
            {RETIREMENT_PROJECTION_ASSUMPTIONS.longevityAge}
          </li>
        </ul>
        <p className="funnel-microcopy assessment-note">{t('helpers', 'assumptions')}</p>
      </div>

      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label={t('fields', 'inflationAwareness')}
          name="inflationAwareness"
          options={localizedOptions(YES_NO_UNSURE_OPTIONS, t, 'yesNoUnsure')}
          value={incomeSources.inflationAwareness}
          onChange={(value) => onIncomeSourcesChange('inflationAwareness', value)}
          required
        />
        <ChoiceGroup
          label={t('fields', 'goals')}
          name="retirementGoals"
          options={localizedOptions(RETIREMENT_GOAL_OPTIONS, t, 'goals')}
          selected={goals.selected}
          onChange={handleGoalsChange}
          required
        />
      </form>
    </QuestionCard>
  )
}
