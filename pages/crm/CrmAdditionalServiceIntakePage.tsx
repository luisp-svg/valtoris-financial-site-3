import {useMemo} from 'react'
import {useParams} from 'react-router-dom'
import CrmServiceIntakePage,{type ServiceIntakeDefinition} from './CrmServiceIntakePage'
import ServiceIntakeForm,{type IntakeFormProps} from '../../crm/serviceIntakes/ServiceIntakeForm'
import {ADDITIONAL_SERVICE_CONTRACTS,emptyAdditionalIntake,isAdditionalServiceId,validateAdditionalIntake} from '../../crm/serviceIntakes/additionalServiceSchema'
import {createServiceIntakeApi} from '../../crm/serviceIntakes/serviceIntakeApi'
import {loadClientIntakeSource} from '../../crm/serviceIntakes/intakeSource'
export default function CrmAdditionalServiceIntakePage(){
 const {serviceId=''}=useParams()
 const definition=useMemo<ServiceIntakeDefinition|null>(()=>{
  if(!isAdditionalServiceId(serviceId))return null
  const c=ADDITIONAL_SERVICE_CONTRACTS[serviceId],validate=(raw:unknown,complete=false)=>validateAdditionalIntake(serviceId,raw,complete)
  return {title:`${c.label} intake`,Form:(props:IntakeFormProps)=><ServiceIntakeForm {...props} title={`${c.label} intake`} sections={c.sections} notice="Record the client’s request and next steps. Do not enter SSNs, full account numbers, passwords, medical answers, or banking details here."/>,api:createServiceIntakeApi('service_intake','save_service_intake',validate,serviceId),validate,loadSource:(client,origin)=>loadClientIntakeSource(client,origin,()=>emptyAdditionalIntake(serviceId))}
 },[serviceId])
 return definition?<CrmServiceIntakePage key={serviceId} definition={definition}/>:<p role="alert">This service intake is unavailable.</p>
}
