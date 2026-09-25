import ServiceIntakeForm, { type IntakeFormProps } from './ServiceIntakeForm'
import { STUDENT_LOAN_INTAKE_SECTIONS, STUDENT_LOAN_TRACKS } from './studentLoanSchema'
export default function StudentLoanIntakeForm(props: IntakeFormProps) {
  return <ServiceIntakeForm {...props} title="Student loan client intake" sections={STUDENT_LOAN_INTAKE_SECTIONS} tracks={STUDENT_LOAN_TRACKS} notice="Use this intake after a report card or from an existing contact. Do not enter passwords, verification codes, Social Security numbers, or full account numbers." />
}
