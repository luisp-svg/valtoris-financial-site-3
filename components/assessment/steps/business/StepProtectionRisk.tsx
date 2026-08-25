import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  CONTINUITY_PLAN_OPTIONS,
  CORE_INSURANCE_OPTIONS,
  KEY_PERSON_BUYSELL_OPTIONS,
  SPECIALIZED_COVERAGE_OPTIONS,
} from '../../business/constants'
import { ProtectionRiskAnswers } from '../../business/types'

type StepProtectionRiskProps = {
  answers: ProtectionRiskAnswers
  onChange: (field: keyof ProtectionRiskAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function StepProtectionRisk({ answers, onChange, t }: StepProtectionRiskProps) {
  return (
    <QuestionCard title={t('ui', 'step5Title')} description={t('helpers', 'step5')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label={t('fields', 'keyPersonBuySell')}
          name="keyPersonBuySell"
          options={localizedOptions(KEY_PERSON_BUYSELL_OPTIONS, t, 'keyPersonBuySell')}
          value={answers.keyPersonBuySell}
          onChange={(value) => onChange('keyPersonBuySell', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'continuityPlan')}
          name="continuityPlan"
          options={localizedOptions(CONTINUITY_PLAN_OPTIONS, t, 'continuityPlan')}
          value={answers.continuityPlan}
          onChange={(value) => onChange('continuityPlan', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'coreInsurance')}
          name="coreInsurance"
          options={localizedOptions(CORE_INSURANCE_OPTIONS, t, 'coreInsurance')}
          value={answers.coreInsurance}
          onChange={(value) => onChange('coreInsurance', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'specializedCoverage')}
          name="specializedCoverage"
          options={localizedOptions(SPECIALIZED_COVERAGE_OPTIONS, t, 'specializedCoverage')}
          value={answers.specializedCoverage}
          onChange={(value) => onChange('specializedCoverage', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
