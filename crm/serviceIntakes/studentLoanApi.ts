import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntakeOrigin } from './intakeSource'
import { validateStudentLoanIntake, type IntakeAnswers } from './studentLoanSchema'

/** Private intake persistence; server migration owns authorization and lifecycle validation. */
export type SavedStudentLoanIntake = {
  id: string
  householdId: string
  status: 'draft' | 'completed'
  updatedAt: string
  answers: IntakeAnswers
}
export async function fetchStudentLoanIntakes(client: SupabaseClient, origin: IntakeOrigin): Promise<SavedStudentLoanIntake[]> {
  const { data, error } = await client.from('assessments').select('id, household_id, assessment_type, capture_channel, status, updated_at, completed_at, deleted_at, answers')
    .eq('household_id', origin.householdId).eq('assessment_type', 'student_loan_intake').eq('capture_channel', 'advisor_onboarding')
    .contains('derived_metrics', { intake_origin: { kind: origin.kind, id: origin.id } }).is('deleted_at', null).order('created_at', { ascending: false })
  if (error) throw new Error('Unable to load saved intakes.')
  return (data ?? []).map(row => normalizeSavedStudentLoanIntake(row, origin.householdId))
}
export function normalizeSavedStudentLoanIntake(raw: unknown, householdId: string): SavedStudentLoanIntake {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The intake could not be confirmed as saved.')
  const row = raw as Record<string, unknown>
  if (typeof row.id !== 'string' || row.household_id !== householdId || row.assessment_type !== 'student_loan_intake' || row.capture_channel !== 'advisor_onboarding' || !['draft', 'completed'].includes(String(row.status)) || typeof row.updated_at !== 'string' || row.deleted_at != null || validateStudentLoanIntake(row.answers).length) throw new Error('The intake could not be confirmed as saved.')
  if ((row.status === 'completed') !== (typeof row.completed_at === 'string')) throw new Error('The intake status could not be confirmed.')
  if (row.status === 'completed' && validateStudentLoanIntake(row.answers, true).length) throw new Error('The completed intake could not be confirmed.')
  return { id: row.id, householdId, status: row.status as SavedStudentLoanIntake['status'], updatedAt: row.updated_at, answers: row.answers as IntakeAnswers }
}
export async function saveStudentLoanIntake(client: SupabaseClient, origin: IntakeOrigin, answers: IntakeAnswers, previous: SavedStudentLoanIntake | null, complete: boolean): Promise<SavedStudentLoanIntake> {
  if (complete && !previous) throw new Error('Save a draft before completing the intake.')
  if (previous?.status === 'completed') throw new Error('Completed intakes are preserved. Start a new intake for an updated review.')
  if (previous && previous.householdId !== origin.householdId) throw new Error('The intake does not belong to this household.')
  const errors = validateStudentLoanIntake(answers, complete)
  if (errors.length) throw new Error(errors[0])
  const { data, error } = await client.rpc('save_student_loan_intake', {
    p_household_id: origin.householdId,
    p_origin_kind: origin.kind,
    p_origin_id: origin.id,
    p_intake_id: previous?.id ?? null,
    p_expected_updated_at: previous?.updatedAt ?? null,
    p_answers: answers,
    p_complete: complete,
  })
  if (error) {
    if (error.message?.includes('INTAKE:conflict')) throw new Error('Another advisor changed this intake. Reload it before saving again.')
    throw new Error('Unable to save intake. Your current entries remain on this page; try again.')
  }
  const saved = normalizeSavedStudentLoanIntake(data, origin.householdId)
  if ((previous && saved.id !== previous.id) || saved.status !== (complete ? 'completed' : 'draft')) throw new Error('The requested save could not be confirmed. Reload before retrying.')
  return saved
}
