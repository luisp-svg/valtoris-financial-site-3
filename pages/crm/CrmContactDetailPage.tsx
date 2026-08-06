import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import ContactEditForm from '../../crm/contacts/ContactEditForm'
import { fetchManualContactDetail } from '../../crm/contacts/contactsApi'
import type { ContactDetail, ContactFormValues } from '../../crm/contacts/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { ROUTES } from '../../constants/routes'

export default function CrmContactDetailPage() {
  const { leadId = '' } = useParams<{ leadId: string }>()
  const { role } = useCrmAuth()
  const isOwner = role === 'owner'
  const navigate = useNavigate()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [detail, setDetail] = useState<ContactDetail | null>(null)
  const [formSeed, setFormSeed] = useState<ContactFormValues | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const reload = useCallback(async () => {
    if (!leadId) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchManualContactDetail(supabase, leadId)
      if (!result) {
        setDetail(null)
        setFormSeed(null)
        setError('This contact is not available.')
        return
      }
      setDetail(result.detail)
      setFormSeed(result.formSeed)
    } catch {
      setError('Unable to load this contact right now.')
      setDetail(null)
      setFormSeed(null)
    } finally {
      setLoading(false)
    }
  }, [leadId, supabase])

  useEffect(() => {
    void reload()
  }, [reload])

  if (loading) {
    return (
      <div className="crm-page">
        <p className="crm-muted">Loading contact…</p>
      </div>
    )
  }

  if (error || !detail || !formSeed) {
    return (
      <div className="crm-page">
        <header className="crm-page-header">
          <div>
            <p className="crm-page-eyebrow">
              <Link to={ROUTES.crmContacts}>Contacts</Link>
            </p>
            <h1 className="crm-page-title">Contact</h1>
          </div>
        </header>
        <div className="crm-banner crm-banner-error" role="alert">
          {error ?? 'Contact not found.'}
        </div>
        <Link to={ROUTES.crmContacts} className="crm-secondary-btn">
          Back to contacts
        </Link>
      </div>
    )
  }

  return (
    <div className="crm-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">
            <Link to={ROUTES.crmContacts}>Contacts</Link>
          </p>
          <h1 className="crm-page-title">{detail.fullName}</h1>
          <p className="crm-page-subtitle">
            {[detail.jobTitle, detail.company].filter(Boolean).join(' · ') || 'Networking contact'}
          </p>
        </div>
        {!editing ? (
          <button type="button" className="crm-primary-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </header>

      {editing ? (
        <ContactEditForm
          leadId={detail.leadId}
          initialValues={formSeed}
          onCancel={() => setEditing(false)}
          onSaved={(savedLeadId) => {
            setEditing(false)
            if (savedLeadId !== leadId) {
              navigate(`/crm/contacts/${savedLeadId}`, { replace: true })
            } else {
              void reload()
            }
          }}
        />
      ) : (
        <div className="crm-contacts-detail-grid">
          <section className="crm-panel">
            <h2 className="crm-panel-title">Person</h2>
            <dl className="crm-contacts-dl">
              <div>
                <dt>Email</dt>
                <dd>{detail.email ?? '—'}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{detail.phone ?? '—'}</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>
                  {detail.website ? (
                    <a href={detail.website} target="_blank" rel="noreferrer">
                      {detail.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{detail.locationLabel ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="crm-panel">
            <h2 className="crm-panel-title">Context</h2>
            <dl className="crm-contacts-dl">
              <div>
                <dt>Category</dt>
                <dd>{detail.categoryLabel}</dd>
              </div>
              <div>
                <dt>How we met</dt>
                <dd>{detail.howWeMet ?? '—'}</dd>
              </div>
              {(isOwner || detail.assignedAdvisorName) && (
                <div>
                  <dt>Assigned advisor</dt>
                  <dd>{detail.assignedAdvisorName ?? '—'}</dd>
                </div>
              )}
              <div>
                <dt>Entered by</dt>
                <dd>{detail.enteredByName ?? '—'}</dd>
              </div>
              <div>
                <dt>Date entered</dt>
                <dd>
                  {detail.dateEntered
                    ? new Date(detail.dateEntered).toLocaleString()
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="crm-panel">
            <h2 className="crm-panel-title">Consent</h2>
            <p>{detail.consent.summaryLabel}</p>
            {detail.consent.hasConsent ? (
              <dl className="crm-contacts-dl">
                <div>
                  <dt>Recorded</dt>
                  <dd>
                    {detail.consent.consentedAt
                      ? new Date(detail.consent.consentedAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{detail.consent.evidenceDescription ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="crm-muted">
                Business-card receipt alone is not consent. Consent stays off unless explicitly
                recorded at create time.
              </p>
            )}
          </section>

          <section className="crm-panel">
            <h2 className="crm-panel-title">Follow-up</h2>
            <dl className="crm-contacts-dl">
              <div>
                <dt>Open tasks</dt>
                <dd>{detail.openTaskCount}</dd>
              </div>
              <div>
                <dt>Next follow-up</dt>
                <dd>{detail.followUpTaskSummary ?? '—'}</dd>
              </div>
              <div>
                <dt>Recent note</dt>
                <dd>{detail.recentNotePreview ?? '—'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}
