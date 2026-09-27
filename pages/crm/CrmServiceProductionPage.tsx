import ServiceCaseWorkspace from '../../crm/production/services/ServiceCaseWorkspace'
import {
  CASE_STAGES,
  CASE_VIEWS,
  dueLabel,
  type CaseView,
} from '../../crm/production/services/caseModel'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import {
  crmHouseholdPath,
  crmOpportunityPath,
  ROUTES,
} from '../../constants/routes'
import { fetchActiveWritingAdvisors } from '../../crm/production/applicationApi'
import { useUnsavedChangesWarning } from '../../crm/production/useUnsavedChangesWarning'
import {
  ServiceFields,
  SplitFields,
} from '../../crm/production/services/ServiceFields'
import {
  listServiceRecords,
  loadServiceRecord,
  searchServiceOpportunities,
  getServiceOpportunity,
  findServiceRecord,
  serviceMutation,
} from '../../crm/production/services/api'
import {
  defaultDraft,
  draftFromRecord,
  isPremium,
  linesForVertical,
  money,
  parseCents,
  recordPayload,
  serviceError,
  splitPayload,
  MODELS,
  SERVICE_LINES,
  STATUSES,
  VALUE_BASES,
} from '../../crm/production/services/model'
import type {
  Allocation,
  OpportunityOption,
  ServiceDraft,
  ServiceRecord,
  WritingSplit,
} from '../../crm/production/services/model'
import '../../crm/production/services/services.css'

const BASE = '/crm/production/services'
const client = () => createSupabaseBrowserClient()
export default function CrmServiceProductionPage() {
  const { serviceId } = useParams()
  const { role } = useCrmAuth()
  return (
    <div className="crm-page service-production">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">Production Center</p>
          <h1 className="crm-page-title">Service production</h1>
          <p className="crm-page-subtitle">
            Track submitted coverage and services against an existing client
            opportunity.
          </p>
        </div>
        <nav className="service-actions">
          <Link className="crm-secondary-btn" to={ROUTES.crmProduction}>
            Life & annuity production
          </Link>
          <Link className="crm-secondary-btn" to={BASE}>
            Service records
          </Link>
        </nav>
      </header>
      {serviceId === 'new' ? (
        <NewService key="new" />
      ) : serviceId ? (
        <ServiceDetail
          key={serviceId}
          id={serviceId}
          owner={role === 'owner'}
        />
      ) : (
        <ServiceList owner={role === 'owner'} />
      )}
    </div>
  )
}
function ErrorBanner({ error }: { error: string }) {
  return error ? (
    <p className="crm-banner crm-banner-error" role="alert">
      {error}
    </p>
  ) : null
}
function ServiceList({ owner }: { owner: boolean }) {
  const [rows, setRows] = useState<ServiceRecord[]>([])
  const [archived, setArchived] = useState(false)
  const [view, setView] = useState<CaseView>('all')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [more, setMore] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let live = true
    setBusy(true)
    setError('')
    setRows([])
    listServiceRecords(client(), 0, archived, view)
      .then((data) => {
        if (live) {
          setRows(data)
          setMore(data.length === 50)
        }
      })
      .catch((e) => {
        if (live) setError(serviceError(e))
      })
      .finally(() => {
        if (live) setBusy(false)
      })
    return () => {
      live = false
    }
  }, [archived, reload, view])
  async function loadMore() {
    setBusy(true)
    setError('')
    try {
      const data = await listServiceRecords(
        client(),
        rows.length,
        archived,
        view,
      )
      setRows([...rows, ...data])
      setMore(data.length === 50)
    } catch (e) {
      setError(serviceError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="service-actions">
        <Link to={`${BASE}/new`} className="crm-primary-btn">
          New service record
        </Link>
        {owner && (
          <label>
            <input
              type="checkbox"
              checked={archived}
              disabled={busy}
              onChange={(e) => setArchived(e.target.checked)}
            />{' '}
            Show archived records
          </label>
        )}
        <button
          className="crm-secondary-btn"
          disabled={busy}
          onClick={() => setReload((n) => n + 1)}
        >
          Refresh
        </button>
      </div>
      <label>
        Case attention view
        <select
          value={view}
          disabled={busy}
          onChange={(e) => setView(e.target.value as CaseView)}
        >
          {Object.entries(CASE_VIEWS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <p>
        Showing {rows.length} matching records
        {more ? ' — load more to continue' : ''}. Filters search all records you
        can access.
      </p>
      <ErrorBanner error={error} />
      <p>
        Values are shown by their basis. Premiums, service fees and recoveries
        are not combined into a revenue total.
      </p>
      {!busy && !error && !rows.length && (
        <div className="service-card">
          <h2>No matching service records</h2>
          <p>
            Choose an existing opportunity to record what was sold, who wrote it
            and its production value.
          </p>
        </div>
      )}
      <div className="service-cards">
        {rows.map((r) => (
          <article key={r.id} className="service-card">
            <p className="service-kicker">
              {SERVICE_LINES[r.service_line]} · {STATUSES[r.production_status]}
            </p>
            <h2>
              <Link to={`${BASE}/${r.id}`}>
                {r.household?.display_name ?? 'Client'} — {r.product_name}
              </Link>
            </h2>
            <p>{r.provider_name}</p>
            <p>
              {VALUE_BASES[r.value_basis]}:{' '}
              <strong>{money(r.value_cents)}</strong>
            </p>
            <p>Submitted: {r.submission_date ?? 'Not recorded'}</p>
            {r.production_status === 'submitted' && (
              <p>
                {CASE_STAGES[r.case_stage ?? 'queued']} · Follow-up:{' '}
                {dueLabel(r.next_follow_up_date ?? null)}
                {!r.case_owner_user_id ? ' · Unassigned case' : ''}
              </p>
            )}
          </article>
        ))}
      </div>
      {busy && <p role="status">Loading service records…</p>}
      {more && (
        <button
          className="crm-secondary-btn"
          disabled={busy}
          onClick={loadMore}
        >
          Load more records
        </button>
      )}
    </>
  )
}
function NewService() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<OpportunityOption[]>([])
  const [opportunity, setOpportunity] = useState<OpportunityOption | null>(null)
  const [advisors, setAdvisors] = useState<
    { id: string; display_name: string }[]
  >([])
  const [draft, setDraft] = useState(defaultDraft)
  const [splits, setSplits] = useState<WritingSplit[]>([
    { advisor_id: '', percent: '100' },
  ])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingRecord, setCheckingRecord] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  useUnsavedChangesWarning(dirty)
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      Promise.all([
        searchServiceOpportunities(client(), search),
        fetchActiveWritingAdvisors(client()),
        params.get('opportunity')
          ? getServiceOpportunity(client(), params.get('opportunity')!)
          : Promise.resolve(null),
      ])
        .then(([opts, ads, requested]) => {
          if (!live) return
          setOptions(opts)
          setAdvisors(ads)
          if (requested) setOpportunity((current) => current ?? requested)
        })
        .catch((e) => {
          if (live) setError(serviceError(e))
        })
        .finally(() => {
          if (live) setLoading(false)
        })
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [search, params])
  useEffect(() => {
    let live = true
    if (!opportunity) return
    const line = linesForVertical(opportunity.vertical.code)[0]
    if (line)
      setDraft({
        ...defaultDraft(),
        service_line: line,
        value_basis: isPremium(line) ? 'annual_premium' : 'contract_value',
      })
    setCheckingRecord(true)
    findServiceRecord(client(), opportunity.id)
      .then((existing) => {
        if (live && existing) {
          setDirty(false)
          navigate(`${BASE}/${existing}`, { replace: true })
        }
      })
      .catch((e) => {
        if (live) setError(serviceError(e))
      })
      .finally(() => {
        if (live) setCheckingRecord(false)
      })
    return () => {
      live = false
    }
  }, [opportunity, navigate])
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!opportunity) return
    setBusy(true)
    setError('')
    try {
      const id = await serviceMutation(client(), 'create_service_production', {
        p_opportunity_id: opportunity.id,
        p_payload: recordPayload(draft),
        p_allocations: splitPayload(splits),
      })
      setDirty(false)
      navigate(`${BASE}/${id}`, { replace: true })
    } catch (e) {
      setError(serviceError(e))
      setBusy(false)
    }
  }
  return (
    <form className="service-card" onSubmit={save}>
      <h2>New service record</h2>
      <p>
        One active production record per opportunity. If it was already created,
        saving opens that record.
      </p>
      <ErrorBanner error={error} />
      <fieldset disabled={busy}>
        <legend>Client opportunity</legend>
        <label>
          Find an opportunity by title
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {loading && <p role="status">Loading opportunities…</p>}
        <label>
          Opportunity
          <select
            required
            value={opportunity?.id ?? ''}
            onChange={(e) => {
              setOpportunity(
                options.find((o) => o.id === e.target.value) ?? null,
              )
              setDirty(true)
            }}
          >
            <option value="">Choose a client opportunity</option>
            {opportunity && !options.some((o) => o.id === opportunity.id) && (
              <option value={opportunity.id}>
                {opportunity.household.display_name} — {opportunity.title}
              </option>
            )}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.household.display_name} — {o.title}
              </option>
            ))}
          </select>
        </label>
        <p>
          {options.length === 50
            ? 'Showing the 50 most recent matches. Refine your search if needed.'
            : 'Only opportunities you can access appear here.'}{' '}
          <Link to={ROUTES.crmPipeline}>Open sales pipeline</Link>
        </p>
        {opportunity && (
          <p>
            <Link to={crmHouseholdPath(opportunity.household_id)}>
              View client
            </Link>{' '}
            ·{' '}
            <Link to={crmOpportunityPath(opportunity.id)}>
              View opportunity
            </Link>
          </p>
        )}
      </fieldset>
      <fieldset disabled={busy || checkingRecord || !opportunity}>
        <legend>Production details</legend>
        {checkingRecord && (
          <p role="status">Checking for an existing production record…</p>
        )}
        <ServiceFields
          draft={draft}
          change={(d) => {
            setDraft(d)
            setDirty(true)
          }}
          lines={
            opportunity
              ? linesForVertical(opportunity.vertical.code)
              : [draft.service_line]
          }
        />
        <SplitFields
          splits={splits}
          change={(s) => {
            setSplits(s)
            setDirty(true)
          }}
          advisors={advisors}
        />
        <p>
          Expected compensation starts as unreviewed. An owner can record a
          supported estimate after saving.
        </p>
        <button className="crm-primary-btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save service record'}
        </button>
      </fieldset>
    </form>
  )
}
function EstimateForm({
  allocation,
  record,
  done,
}: {
  allocation: Allocation
  record: ServiceRecord
  done: () => Promise<void>
}) {
  const [model, setModel] = useState(
    allocation.compensation_model ?? 'flat_referral',
  )
  const [amount, setAmount] = useState(
    allocation.expected_cents === null
      ? ''
      : (allocation.expected_cents / 100).toFixed(2),
  )
  const [basis, setBasis] = useState(allocation.review_basis ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const cents = parseCents(amount)
      if (cents === null)
        throw new Error(
          'Enter an expected amount, including zero when supported.',
        )
      await serviceMutation(client(), 'review_service_production_estimate', {
        p_id: record.id,
        p_revision: record.revision,
        p_allocation_id: allocation.id,
        p_model: model,
        p_expected_cents: cents,
        p_basis: basis,
      })
      await done()
    } catch (e) {
      setError(serviceError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={save}>
      <fieldset disabled={busy}>
        <legend>
          Owner review — {allocation.advisor?.display_name ?? 'Writing advisor'}
        </legend>
        <ErrorBanner error={error} />
        <label>
          Compensation model
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as keyof typeof MODELS)}
          >
            {Object.entries(MODELS)
              .filter(
                ([v]) =>
                  v === 'flat_referral' ||
                  v === 'percent_contract' ||
                  (v === 'pc_split' && record.service_line.startsWith('pc_')) ||
                  (v === 'tax_recovery' &&
                    record.service_line === 'tax_strategy') ||
                  (v === 'student_loan_service' &&
                    record.service_line === 'student_loans') ||
                  (v === 'credit_repair' &&
                    record.service_line === 'credit_repair'),
              )
              .map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
          </select>
        </label>
        <label>
          Expected amount for this advisor (USD)
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Calculation basis and evidence
          <textarea
            required
            maxLength={2000}
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder="Describe the agreed rate, value basis, advisor split and source supporting this estimate."
          />
        </label>
        <p>
          This is the final expected amount for this advisor. The writing share
          will not be applied again.
        </p>
        <button className="crm-primary-btn">
          {busy ? 'Saving…' : 'Save reviewed estimate'}
        </button>
      </fieldset>
    </form>
  )
}
function ServiceDetail({ id, owner }: { id: string; owner: boolean }) {
  const navigate = useNavigate()
  const [caseEditing, setCaseEditing] = useState(false)
  const [data, setData] = useState<Awaited<
    ReturnType<typeof loadServiceRecord>
  > | null>(null)
  const [draft, setDraft] = useState<ServiceDraft>(defaultDraft)
  const [dirty, setDirty] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [splitEditing, setSplitEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [splits, setSplits] = useState<WritingSplit[]>([])
  const [advisors, setAdvisors] = useState<
    { id: string; display_name: string }[]
  >([])
  useUnsavedChangesWarning(dirty)
  const reload = useCallback(async () => {
    const fresh = await loadServiceRecord(client(), id)
    setData(fresh)
    setDraft(draftFromRecord(fresh.record))
    setDirty(false)
    setEditing(false)
    setSplitEditing(false)
    setReason('')
  }, [id])
  useEffect(() => {
    let live = true
    setData(null)
    loadServiceRecord(client(), id)
      .then((fresh) => {
        if (live) {
          setData(fresh)
          setDraft(draftFromRecord(fresh.record))
        }
      })
      .catch((e) => {
        if (live) setError(serviceError(e))
      })
    return () => {
      live = false
    }
  }, [id])
  async function mutate(
    name:
      | 'update_service_production'
      | 'set_service_production_allocations'
      | 'archive_service_production',
    extra: Record<string, unknown>,
  ) {
    if (!data) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await serviceMutation(client(), name, {
        p_id: id,
        p_revision: data.record.revision,
        p_reason: reason,
        ...extra,
      })
      setNotice('Saved.')
      await reload()
      return true
    } catch (e) {
      setError(serviceError(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = recordPayload(draft)
      const { service_line: _line, ...patch } = payload
      void _line
      await mutate('update_service_production', { p_payload: patch })
    } catch (e) {
      setError(serviceError(e))
    }
  }
  async function editSplits() {
    if (caseEditing) return
    setError('')
    try {
      setAdvisors(await fetchActiveWritingAdvisors(client()))
      setSplits(
        data!.allocations.map((a) => ({
          advisor_id: a.advisor_id,
          percent: (a.writing_bps / 100).toString(),
        })),
      )
      setSplitEditing(true)
      setReason('')
    } catch (e) {
      setError(serviceError(e))
    }
  }
  return (
    <>
      <ErrorBanner error={error} />
      {notice && <p role="status">{notice}</p>}
      <button
        className="crm-secondary-btn"
        disabled={busy || caseEditing}
        onClick={() => {
          if (dirty && !window.confirm('Discard unsaved changes and reload?'))
            return
          setError('')
          reload().catch((e) => setError(serviceError(e)))
        }}
      >
        Reload record
      </button>
      {!data ? (
        <p role="status">{error ? 'Record unavailable.' : 'Loading record…'}</p>
      ) : (
        <>
          <section className="service-card">
            <p className="service-kicker">
              {SERVICE_LINES[data.record.service_line]} ·{' '}
              {STATUSES[data.record.production_status]}
              {data.record.deleted_at ? ' · Archived' : ''}
            </p>
            <h2>{data.record.product_name}</h2>
            <p>
              <Link to={crmHouseholdPath(data.record.household_id)}>
                {data.record.household?.display_name ?? 'View client'}
              </Link>{' '}
              ·{' '}
              <Link to={crmOpportunityPath(data.record.opportunity_id)}>
                {data.record.opportunity?.title ?? 'View opportunity'}
              </Link>
            </p>
            {editing ? (
              <form onSubmit={save}>
                <fieldset disabled={busy || caseEditing}>
                  <legend>Edit production details</legend>
                  <ServiceFields
                    draft={draft}
                    change={(d) => {
                      setDraft(d)
                      setDirty(true)
                    }}
                    lines={[draft.service_line]}
                    locked
                  />
                  <label>
                    Reason for change
                    <textarea
                      required
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <p>
                    Changing the provider, product, submission date, value or
                    value basis requires a fresh compensation review.
                  </p>
                  <div className="service-actions">
                    <button className="crm-primary-btn">Save changes</button>
                    <button
                      type="button"
                      className="crm-secondary-btn"
                      onClick={() => {
                        setEditing(false)
                        setDirty(false)
                        setDraft(draftFromRecord(data.record))
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </fieldset>
              </form>
            ) : (
              <>
                <dl className="service-facts">
                  <div>
                    <dt>Provider / carrier</dt>
                    <dd>{data.record.provider_name}</dd>
                  </div>
                  <div>
                    <dt>{VALUE_BASES[data.record.value_basis]}</dt>
                    <dd>{money(data.record.value_cents)}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{data.record.submission_date ?? 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd>{data.record.external_reference ?? 'Not recorded'}</dd>
                  </div>
                </dl>
                {data.record.notes && (
                  <p className="service-notes">{data.record.notes}</p>
                )}
                {!data.record.deleted_at && !splitEditing && (
                  <button
                    className="crm-secondary-btn"
                    disabled={caseEditing}
                    onClick={() => {
                      setReason('')
                      if (caseEditing) return
                      setEditing(true)
                    }}
                  >
                    Edit production details
                  </button>
                )}
              </>
            )}
          </section>
          {!editing && !splitEditing && (
            <ServiceCaseWorkspace
              key={`${id}-${data.record.revision}`}
              record={data.record}
              owner={owner}
              done={reload}
              onEditingChange={setCaseEditing}
            />
          )}
          <section className="service-card">
            <h2>Writing-advisor compensation</h2>
            <p>
              Expected compensation is a reviewed estimate. Actual paid
              compensation: <strong>Not tracked yet</strong>.
            </p>
            {!owner && (
              <p>
                Only your compensation is shown. Other writing advisors’ amounts
                remain private.
              </p>
            )}
            {!data.allocations.length && (
              <p>No writing allocation is visible to your account.</p>
            )}
            {data.allocations.map((a) => (
              <article
                className="service-estimate"
                key={`${a.id}-${data.record.revision}`}
              >
                <h3>{a.advisor?.display_name ?? 'Writing advisor'}</h3>
                <p>
                  Writing share: {a.writing_bps / 100}% · Expected:{' '}
                  <strong>
                    {a.review_status === 'reviewed'
                      ? money(a.expected_cents)
                      : 'Awaiting owner review'}
                  </strong>
                </p>
                {a.compensation_model && (
                  <p>
                    {MODELS[a.compensation_model]} — {a.review_basis}
                  </p>
                )}
                {owner &&
                  !data.record.deleted_at &&
                  !editing &&
                  !caseEditing &&
                  !splitEditing && (
                    <details>
                      <summary>Review expected compensation</summary>
                      <EstimateForm
                        allocation={a}
                        record={data.record}
                        done={reload}
                      />
                    </details>
                  )}
              </article>
            ))}
            {owner &&
              !data.record.deleted_at &&
              !editing &&
              (splitEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    try {
                      void mutate('set_service_production_allocations', {
                        p_allocations: splitPayload(splits),
                      })
                    } catch (e) {
                      setError(serviceError(e))
                    }
                  }}
                >
                  <fieldset disabled={busy || caseEditing}>
                    <legend>Update writing shares</legend>
                    <SplitFields
                      splits={splits}
                      change={(s) => {
                        setSplits(s)
                        setDirty(true)
                      }}
                      advisors={advisors}
                    />
                    <label>
                      Reason for change
                      <textarea
                        required
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <p>
                      Changing writing shares resets all estimates for owner
                      review.
                    </p>
                    <button className="crm-primary-btn">
                      Save writing shares
                    </button>
                    <button
                      type="button"
                      className="crm-secondary-btn"
                      onClick={() => {
                        setSplitEditing(false)
                        setDirty(false)
                      }}
                    >
                      Cancel
                    </button>
                  </fieldset>
                </form>
              ) : (
                <button
                  className="crm-secondary-btn"
                  disabled={caseEditing}
                  onClick={editSplits}
                >
                  Edit writing shares
                </button>
              ))}
          </section>
          <section className="service-card">
            <h2>Record history</h2>
            <p>Most recent 100 events visible to your account.</p>
            <ol>
              {data.history.map((h) => (
                <li key={h.id}>
                  <strong>{h.event_type.replace(/_/g, ' ')}</strong> ·{' '}
                  {new Date(h.created_at).toLocaleString()}
                  <p>{h.reason}</p>
                </li>
              ))}
            </ol>
          </section>
          {owner && !data.record.deleted_at && !editing && !splitEditing && (
            <section className="service-card">
              <button
                type="button"
                className="crm-secondary-btn"
                aria-expanded={archiving}
                aria-controls="service-archive-form"
                disabled={caseEditing}
                onClick={() => setArchiving((v) => !v)}
              >
                Archive this record
              </button>
              {archiving && (
                <form
                  id="service-archive-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void mutate('archive_service_production', {}).then(
                      (saved) => {
                        if (saved) navigate(BASE)
                      },
                    )
                  }}
                >
                  <fieldset disabled={busy || caseEditing}>
                    <legend>Archive reason</legend>
                    <p>
                      Archiving removes this record from the active list. Its
                      details and history remain available to the owner.
                    </p>
                    <textarea
                      required
                      maxLength={1000}
                      aria-label="Archive reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button className="crm-secondary-btn">
                      Archive record
                    </button>
                  </fieldset>
                </form>
              )}
            </section>
          )}
        </>
      )}
    </>
  )
}
