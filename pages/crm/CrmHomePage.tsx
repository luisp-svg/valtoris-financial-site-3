import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import CrmTodayTasksCard from '../../crm/components/CrmTodayTasksCard'

const PLACEHOLDER_SECTIONS = [
  {
    title: 'Upcoming Appointments',
    description: 'Scheduled client meetings will appear here.',
  },
  {
    title: 'Recent Leads',
    description: 'Newest inbound leads will appear here.',
  },
  {
    title: 'Recent Assessments',
    description: 'Latest diagnostic submissions will appear here.',
  },
  {
    title: 'Pipeline Snapshot',
    description: 'Stage counts and opportunity momentum will appear here.',
  },
] as const

export default function CrmHomePage() {
  const { email, role, profile } = useCrmAuth()

  return (
    <div className="crm-home">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">CRM Home</p>
          <h1 className="crm-page-title">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="crm-page-subtitle">
            Signed in as {email}
            {role ? ` · ${role}` : ''}
          </p>
        </div>
      </header>

      <div className="crm-home-grid">
        <CrmTodayTasksCard />
        {PLACEHOLDER_SECTIONS.map((section) => (
          <section key={section.title} className="crm-placeholder-panel">
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <p className="crm-placeholder-note">
              Placeholder — real data integration will be added next.
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
