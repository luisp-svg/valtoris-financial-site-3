import CrmServiceIntakePage, { type ServiceIntakeDefinition } from './CrmServiceIntakePage'
import LifeInsuranceIntakeForm from '../../crm/serviceIntakes/LifeInsuranceIntakeForm'
import { createServiceIntakeApi } from '../../crm/serviceIntakes/serviceIntakeApi'
import { emptyLifeInsuranceIntake, validateLifeInsuranceIntake } from '../../crm/serviceIntakes/lifeInsuranceSchema'
import { loadClientIntakeSource } from '../../crm/serviceIntakes/intakeSource'
const definition: ServiceIntakeDefinition = {
  title: 'Life Insurance intake', Form: LifeInsuranceIntakeForm,
  api: createServiceIntakeApi('life_insurance_intake', 'save_life_insurance_intake', validateLifeInsuranceIntake),
  validate: validateLifeInsuranceIntake,
  loadSource: (client, origin) => loadClientIntakeSource(client, origin, emptyLifeInsuranceIntake),
}
export default function CrmLifeInsuranceIntakePage() { return <CrmServiceIntakePage definition={definition} /> }
