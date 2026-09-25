import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import QuickAddContactForm from '../../crm/contacts/QuickAddContactForm'
import { CLIENT_INTAKE_SERVICES } from '../../crm/serviceIntakes/intakeHubApi'
export default function CrmClientIntakeNewPage() {
  const navigate = useNavigate()
  const [serviceId,setServiceId] = useState<string>(CLIENT_INTAKE_SERVICES[0].id)
  const [started,setStarted] = useState(false)
  const service = CLIENT_INTAKE_SERVICES.find(s => s.id === serviceId)!
  return <div className="crm-page">
    <header className="crm-page-header"><div><h1>Start client intake</h1><p>No report card required. Save the client's basic information to create their contact and household, then continue to the intake.</p></div></header>
    <p>Already in the CRM? <Link to="/crm/households">Open their household</Link> and use Client intakes at the top.</p>
    <label className="crm-field">Service <select value={serviceId} disabled={started} onChange={e => setServiceId(e.target.value)}>{CLIENT_INTAKE_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    {!started ? <button className="crm-primary-btn" onClick={() => setStarted(true)}>Continue with new client</button> : <QuickAddContactForm embedded title={`New client · ${service.label}`} onCancel={() => navigate('/crm/households')} onCreatedRecord={record => navigate(service.path({kind:'contact',id:record.leadId,householdId:record.householdId}))} onOpenExistingHousehold={id => navigate(`/crm/households/${id}`)} />}
  </div>
}
