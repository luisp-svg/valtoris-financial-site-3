import { mainReportCard } from './cardProfiles.js'
import { combinedQuestions, COMBINED_FORMAT, type CombinedAnswers, type Priority } from './engine.js'
import type { Locale } from '../shortForm/catalog.js'

/** Public examples never read saved answers, submit forms, or contact the CRM. */
export function sampleReportAnswers(selected: Priority[], locale: Locale, planningVersion?: 1): CombinedAnswers {
  const diagnostic: CombinedAnswers['diagnostic'] = {}
  const amounts: Record<string, string> = { 'family.annual_support':'60000','family.support_years':'10','family.mortgage_balance':'250000','family.dime_debt':'20000','family.dime_education':'50000','family.life_coverage':'300000','family.other_needs':'30000','protection.monthly_expenses':'4500','protection.continuing_income':'1000','protection.monthly_benefit':'2000' }
  for (let pass = 0; pass < 5; pass++) {
    const questions = combinedQuestions(selected, diagnostic, 1, 1, 1, undefined, planningVersion)
    for (const { id, question } of questions) {
      if (id in diagnostic) continue
      diagnostic[id] = amounts[id] ?? (question.kind === 'state' ? 'TX'
        : question.kind === 'number' ? '2500'
        : question.kind === 'multi' ? [question.options?.[0]?.value ?? 'unknown']
        : question.kind === 'date' ? 'unknown'
        : question.options?.find(option => option.value === (id.includes('review') ? 'partial' : 'current'))?.value
          ?? question.options?.[0]?.value ?? 'unknown')
    }
  }
  const active = new Set(combinedQuestions(selected, diagnostic, 1, 1, 1, undefined, planningVersion).map(question => question.id))
  return { format: COMBINED_FORMAT, strategyVersion: 1, cardVersion: 1, insuranceRoutingVersion: 1, ...(planningVersion && mainReportCard(selected) ? { planningVersion } : {}), selected,
    diagnostic: Object.fromEntries(Object.entries(diagnostic).filter(([key]) => active.has(key))), locale,
    contact: { fullName: 'Sample Household', email: 'sample@example.invalid', phone: '+12025550100' } }
}
