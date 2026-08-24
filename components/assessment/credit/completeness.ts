import { isQuestionComplete } from '../specialized/answers'
import type { SpecializedAnswerMap } from '../specialized/types'
import {
  CREDIT_CONTACT_STEP,
  CREDIT_DIAGNOSTIC_QUESTION_IDS,
  CREDIT_FIRST_DIAGNOSTIC_STEP,
  CREDIT_LAST_DIAGNOSTIC_STEP,
  CREDIT_WELCOME_STEP,
} from './constants'
import { CREDIT_QUESTIONS } from './questions'
import type { CreditAssessmentAnswers, CreditDiagnosticAnswers } from './types'

export function diagnosticToAnswerMap(diagnostic: CreditDiagnosticAnswers): SpecializedAnswerMap {
  return {
    credit_goal: diagnostic.credit_goal,
    self_reported_score: diagnostic.self_reported_score,
    last_reviewed: diagnostic.last_reviewed,
    inaccuracy_belief: diagnostic.inaccuracy_belief,
    late_recent: diagnostic.late_recent,
    payment_consistency: diagnostic.payment_consistency,
    negative_items: diagnostic.negative_items,
    utilization: diagnostic.utilization,
    open_revolving: diagnostic.open_revolving,
    oldest_account: diagnostic.oldest_account,
    hard_inquiries: diagnostic.hard_inquiries,
    new_accounts: diagnostic.new_accounts,
    minimums: diagnostic.minimums,
    current_status: diagnostic.current_status,
    urgency: diagnostic.urgency,
    prior_actions: diagnostic.prior_actions,
  }
}

export function answerMapToDiagnostic(
  values: SpecializedAnswerMap,
  previous: CreditDiagnosticAnswers,
): CreditDiagnosticAnswers {
  return {
    ...previous,
    credit_goal: typeof values.credit_goal === 'string' ? values.credit_goal : previous.credit_goal,
    self_reported_score:
      typeof values.self_reported_score === 'string'
        ? values.self_reported_score
        : previous.self_reported_score,
    last_reviewed: typeof values.last_reviewed === 'string' ? values.last_reviewed : previous.last_reviewed,
    inaccuracy_belief:
      typeof values.inaccuracy_belief === 'string' ? values.inaccuracy_belief : previous.inaccuracy_belief,
    late_recent: typeof values.late_recent === 'string' ? values.late_recent : previous.late_recent,
    payment_consistency:
      typeof values.payment_consistency === 'string'
        ? values.payment_consistency
        : previous.payment_consistency,
    negative_items: Array.isArray(values.negative_items) ? values.negative_items : previous.negative_items,
    utilization: typeof values.utilization === 'string' ? values.utilization : previous.utilization,
    open_revolving:
      typeof values.open_revolving === 'string' ? values.open_revolving : previous.open_revolving,
    oldest_account:
      typeof values.oldest_account === 'string' ? values.oldest_account : previous.oldest_account,
    hard_inquiries:
      typeof values.hard_inquiries === 'string' ? values.hard_inquiries : previous.hard_inquiries,
    new_accounts: typeof values.new_accounts === 'string' ? values.new_accounts : previous.new_accounts,
    minimums: typeof values.minimums === 'string' ? values.minimums : previous.minimums,
    current_status:
      typeof values.current_status === 'string' ? values.current_status : previous.current_status,
    urgency: typeof values.urgency === 'string' ? values.urgency : previous.urgency,
    prior_actions: Array.isArray(values.prior_actions) ? values.prior_actions : previous.prior_actions,
  }
}

export function isCreditDiagnosticComplete(diagnostic: CreditDiagnosticAnswers): boolean {
  const values = diagnosticToAnswerMap(diagnostic)
  return CREDIT_QUESTIONS.every((question) => isQuestionComplete(question, values))
}

export function isCreditContactComplete(answers: CreditAssessmentAnswers): boolean {
  const { firstName, lastName, email, phone } = answers.contact
  return [firstName, lastName, email, phone].every((value) => value.trim() !== '')
}

export function isCreditStepComplete(step: number, answers: CreditAssessmentAnswers): boolean {
  if (step === CREDIT_WELCOME_STEP) return true
  if (step === CREDIT_CONTACT_STEP) return isCreditContactComplete(answers)
  if (step < CREDIT_FIRST_DIAGNOSTIC_STEP || step > CREDIT_LAST_DIAGNOSTIC_STEP) {
    return false
  }
  const question = CREDIT_QUESTIONS[step - CREDIT_FIRST_DIAGNOSTIC_STEP]
  if (!question) return false
  return isQuestionComplete(question, diagnosticToAnswerMap(answers.diagnostic))
}

export function creditDiagnosticQuestionIds(): readonly string[] {
  return CREDIT_DIAGNOSTIC_QUESTION_IDS
}
