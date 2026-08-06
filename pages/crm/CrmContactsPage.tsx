import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { CONTACT_CATEGORY_OPTIONS } from '../../crm/contacts/categoryLabels'
import {
  CONTACTS_FETCH_CAP,
  CONTACTS_PAGE_SIZE,
  fetchManualContacts,
  listActiveAdvisorsForAssignment,
} from '../../crm/contacts/contactsApi'
import type {
  AdvisorOption,
  ContactCategory,
  ContactListItem,
} from '../../crm/contacts/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { crmContactNewPath, crmContactPath } from '../../constants/routes'

export default function CrmContactsPage() {
  const { role } = useCrmAuth()
  const isOwner = role === 'owner'
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [items, setItems] = useState<ContactListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ContactCategory | 'all'>('all')
  const [advisorId, setAdvisorId] = useState<string | 'all'>('all')
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCapped, setFetchCapped] = useState(false)

  useEffect(() => {
    if (!isOwner) return
    void listActiveAdvisorsForAssignment(supabase)
      .then(setAdvisors)
      .catch(() => setAdvisors([]))
  }, [isOwner, supabase])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchManualContacts(supabase, {
        search,
        category,
        assignedAdvisorId: isOwner ? advisorId : 'all',
        page,
        pageSize: CONTACTS_PAGE_SIZE,
      })
      setItems(result.items)
      setTotal(result.total)
      setFetchCapped(result.fetchCapped)
    } catch {
      setError('Unable to load contacts right now.')
      setItems([])
      setTotal(0)
      setFetchCapped(false)
    } finally {
      setLoading(false)
    }
  }, [supabase, search, category, advisorId, page, isOwner])

  useEffect(() => {
    void reload()
  }, [reload])

  const pageCount = Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE))

  return (
    <div className="crm-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">Contacts</p>
          <h1 className="crm-page-title">Networking contacts</h1>
          <p className="crm-page-subtitle">
            Manually added people and partners — separate from Intake and Households.
          </p>
        </div>
        <Link to={crmContactNewPath()} className="crm-primary-btn">
          Quick Add Contact
        </Link>
      </header>

      {fetchCapped ? (
        <div className="crm-banner crm-banner-warning" role="status">
          Showing the newest {CONTACTS_FETCH_CAP} contacts loaded for search and filters. Narrow
          your search if a contact is missing. Pagination here is client-side over that loaded set,
          not a server page of {CONTACTS_PAGE_SIZE}.
        </div>
      ) : null}

      <div className="crm-panel crm-contacts-filters">
        <label className="crm-field">
          <span>Search</span>
          <input
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            placeholder="Name, company, email, or phone"
            aria-label="Search contacts"
          />
        </label>
        <label className="crm-field">
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => {
              setPage(1)
              setCategory(e.target.value as ContactCategory | 'all')
            }}
          >
            <option value="all">All categories</option>
            {CONTACT_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {isOwner ? (
          <label className="crm-field">
            <span>Assigned advisor</span>
            <select
              value={advisorId}
              onChange={(e) => {
                setPage(1)
                setAdvisorId(e.target.value)
              }}
            >
              <option value="all">All advisors</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? <p className="crm-muted">Loading contacts…</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="crm-panel">
          <p className="crm-page-subtitle">No contacts match these filters.</p>
          <Link to={crmContactNewPath()} className="crm-secondary-btn">
            Add your first contact
          </Link>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="crm-panel crm-contacts-table-wrap">
          <table className="crm-table crm-contacts-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Company</th>
                <th scope="col">Category</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col">Location</th>
                {isOwner ? <th scope="col">Advisor</th> : null}
                <th scope="col">Entered</th>
                <th scope="col">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.leadId}>
                  <td>
                    <Link to={crmContactPath(item.leadId)}>{item.fullName}</Link>
                    {item.jobTitle ? <div className="crm-muted">{item.jobTitle}</div> : null}
                    {item.howWeMet ? <div className="crm-muted">{item.howWeMet}</div> : null}
                  </td>
                  <td>{item.company ?? '—'}</td>
                  <td>{item.categoryLabel}</td>
                  <td>{item.email ?? '—'}</td>
                  <td>{item.phone ?? '—'}</td>
                  <td>{item.locationLabel ?? '—'}</td>
                  {isOwner ? <td>{item.assignedAdvisorName ?? '—'}</td> : null}
                  <td>
                    {item.dateEntered
                      ? new Date(item.dateEntered).toLocaleDateString()
                      : '—'}
                  </td>
                  <td>{item.followUpTaskSummary ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="crm-contacts-pagination">
            <button
              type="button"
              className="crm-secondary-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="crm-muted">
              Page {page} of {pageCount} · {total} contacts
            </span>
            <button
              type="button"
              className="crm-secondary-btn"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
