import { createServiceIntakeApi, type SavedServiceIntake } from './serviceIntakeApi'
import { validateStudentLoanIntake, validateSavedStudentLoanIntake } from './studentLoanSchema'
const api = createServiceIntakeApi('student_loan_intake', 'save_student_loan_intake', validateStudentLoanIntake, undefined, validateSavedStudentLoanIntake)
export type SavedStudentLoanIntake = SavedServiceIntake
export const fetchStudentLoanIntakes = api.fetchIntakes
export const normalizeSavedStudentLoanIntake = api.normalizeSavedIntake
export const saveStudentLoanIntake = api.saveIntake
export default api
