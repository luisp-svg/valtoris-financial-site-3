import CrmServiceIntakePage, { type ServiceIntakeDefinition } from './CrmServiceIntakePage'
import StudentLoanIntakeForm from '../../crm/serviceIntakes/StudentLoanIntakeForm'
import api from '../../crm/serviceIntakes/studentLoanApi'
import { validateStudentLoanIntake } from '../../crm/serviceIntakes/studentLoanSchema'
import { loadStudentLoanIntakeSource } from '../../crm/serviceIntakes/intakeSource'
const definition: ServiceIntakeDefinition = { title: 'Student Loan intake', Form: StudentLoanIntakeForm, api, validate: validateStudentLoanIntake, loadSource: loadStudentLoanIntakeSource }
export default function CrmStudentLoanIntakePage() { return <CrmServiceIntakePage definition={definition} /> }
