import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../../lib/supabase/client'
import { useCrmAuth } from '../../auth/CrmAuthContext'
import { useUnsavedChangesWarning } from '../useUnsavedChangesWarning'
import { serviceError, type ServiceRecord } from './model'
import {
  CASE_STAGES,
  REQUIREMENT_STATUSES,
  dueLabel,
  requirementOpen,
  requirementTransitions,
  type CaseRequirement,
  type CaseAssignee,
  type CaseStage,
} from './caseModel'
const client = () => createSupabaseBrowserClient()
export default function ServiceCaseWorkspace({
  record,
  owner,
  done,
  onEditingChange,
}: {
  record: ServiceRecord
  owner: boolean
  done: () => Promise<void>
  onEditingChange: (editing: boolean) => void
}) {
  const { profile } = useCrmAuth()
  const [requirements, setRequirements] = useState<CaseRequirement[]>([])
  const [assignees, setAssignees] = useState<CaseAssignee[]>([])
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [caseOwner, setCaseOwner] = useState(record.case_owner_user_id ?? '')
  const [stage, setStage] = useState<CaseStage>(record.case_stage ?? 'queued')
  const [followUp, setFollowUp] = useState(record.next_follow_up_date ?? '')
  const [waiting, setWaiting] = useState(record.waiting_reason ?? '')
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState<CaseRequirement | 'new' | null>(null)
  useUnsavedChangesWarning(dirty)
  useEffect(() => {
    onEditingChange(dirty || busy || editing !== null)
    return () => onEditingChange(false)
  }, [dirty, busy, editing, onEditingChange])
  const active = !record.deleted_at && record.production_status === 'submitted'
  useEffect(() => {
    let live = true
    async function load() {
      try {
        const c = client()
        const users = await c.rpc('service_case_assignees', {
          p_record: record.id,
        })
        if (users.error) throw users.error
        const rows: CaseRequirement[] = []
        for (let offset = 0; ; offset += 100) {
          const result = await c
            .from('service_production_requirements')
            .select('*')
            .eq('record_id', record.id)
            .is('deleted_at', null)
            .order('created_at')
            .order('id')
            .range(offset, offset + 99)
          if (result.error) throw result.error
          rows.push(...(result.data as CaseRequirement[]))
          if (result.data.length < 100) break
          if (!live) return
        }
        if (live) {
          setRequirements(rows)
          setAssignees(users.data ?? [])
        }
      } catch (e) {
        if (live) setError(serviceError(e))
      } finally {
        if (live) setLoading(false)
      }
    }
    void load()
    return () => {
      live = false
    }
  }, [record.id])
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await client().rpc('update_service_case', {
        p_id: record.id,
        p_revision: record.revision,
        p_fields: {
          case_owner_user_id: caseOwner || null,
          case_stage: stage,
          next_follow_up_date: followUp || null,
          waiting_reason: waiting || null,
        },
        p_reason: reason,
      })
      if (result.error) throw result.error
      setDirty(false)
      await done()
    } catch (e) {
      setError(serviceError(e))
    } finally {
      setBusy(false)
    }
  }
  const name = (id: string | null | undefined) =>
    !id
      ? 'Unassigned'
      : (assignees.find((a) => a.id === id)?.display_name ??
        'User no longer eligible — review assignment')
  const pending = requirements.filter(requirementOpen)
  return (
    <section className="service-card" aria-labelledby="service-case-heading">
      <h2 id="service-case-heading">Case workspace</h2>
      <p>
        {active
          ? 'Manage the work needed to complete this service.'
          : record.deleted_at
            ? 'Archived case — retained for reference.'
            : record.production_status === 'draft'
              ? 'Submit this record to begin case work.'
              : 'Closed case — an owner can reopen it through production details.'}
      </p>
      <dl className="service-facts">
        <div>
          <dt>Case owner</dt>
          <dd>{name(record.case_owner_user_id)}</dd>
        </div>
        <div>
          <dt>Next follow-up</dt>
          <dd>{dueLabel(record.next_follow_up_date ?? null)}</dd>
        </div>
        <div>
          <dt>Work stage</dt>
          <dd>
            {active
              ? CASE_STAGES[record.case_stage ?? 'queued']
              : record.production_status}
          </dd>
        </div>
      </dl>
      {record.waiting_reason && <p>Waiting for: {record.waiting_reason}</p>}
      {error && (
        <p role="alert" className="crm-banner crm-banner-error">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading case requirements…</p>}
      {active && !loading && (
        <details>
          <summary>Update case work</summary>
          <form onSubmit={save} onChange={() => setDirty(true)}>
            <fieldset disabled={busy || !!editing}>
              <legend>Case work</legend>
              <div className="service-grid">
                <label>
                  Case owner
                  <select
                    value={caseOwner}
                    disabled={!owner}
                    onChange={(e) => setCaseOwner(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {caseOwner &&
                      !assignees.some((a) => a.id === caseOwner) && (
                        <option value={caseOwner}>
                          User no longer eligible
                        </option>
                      )}
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.display_name}
                      </option>
                    ))}
                  </select>
                  <small>
                    Assignment does not grant client access. An owner manages
                    case ownership.
                  </small>
                </label>
                <label>
                  Work stage
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as CaseStage)}
                  >
                    {Object.entries(CASE_STAGES).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Next follow-up date
                  <input
                    type="date"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                  />
                </label>
                {stage.startsWith('waiting_') && (
                  <label>
                    Waiting reason
                    <textarea
                      required
                      maxLength={500}
                      value={waiting}
                      onChange={(e) => setWaiting(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Reason for case change
                  <textarea
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </div>
              <button className="crm-primary-btn">
                {busy ? 'Saving…' : 'Save case work'}
              </button>
              <button
                type="button"
                className="crm-secondary-btn"
                onClick={() => {
                  setCaseOwner(record.case_owner_user_id ?? '')
                  setStage(record.case_stage ?? 'queued')
                  setFollowUp(record.next_follow_up_date ?? '')
                  setWaiting(record.waiting_reason ?? '')
                  setReason('')
                  setError('')
                  setDirty(false)
                }}
              >
                Cancel case changes
              </button>
            </fieldset>
          </form>
        </details>
      )}
      <h3>Requirements</h3>
      <p>
        Track administrative work only. Keep medical details and documents out
        of requirement labels and reasons.
      </p>
      {!loading && !error && (
        <p>
          {pending.length} open or scheduled ·{' '}
          {pending.filter((q) => q.is_blocking).length} blocking completion
        </p>
      )}
      {!loading && !error && !requirements.length && (
        <p>No requirements recorded.</p>
      )}
      {requirements.map((q) => (
        <article className="service-estimate" key={q.id}>
          <h4>{q.label}</h4>
          <p>
            {REQUIREMENT_STATUSES[q.status]} ·{' '}
            {q.is_blocking ? 'Required for completion' : 'Optional'} ·{' '}
            {name(q.assigned_user_id)}
          </p>
          <p>
            Due:{' '}
            {requirementOpen(q)
              ? dueLabel(q.due_date)
              : (q.due_date ?? 'Not set')}
            {q.scheduled_for ? ` · Scheduled: ${q.scheduled_for}` : ''}
          </p>
          {active && (
            <button
              className="crm-secondary-btn"
              disabled={busy || dirty || !!editing}
              onClick={() => setEditing(q)}
            >
              Update {q.label}
            </button>
          )}
        </article>
      ))}
      {active && !loading && !error && !editing && (
        <button
          className="crm-secondary-btn"
          disabled={busy || dirty}
          onClick={() => setEditing('new')}
        >
          Add requirement
        </button>
      )}
      {dirty && <p>Save case work before editing requirements.</p>}
      {editing && (
        <RequirementEditor
          record={record}
          existing={editing === 'new' ? null : editing}
          assignees={assignees}
          owner={owner}
          userId={profile?.id ?? ''}
          cancel={() => setEditing(null)}
          done={done}
        />
      )}
      <h3>Follow-up tasks</h3>
      <p>
        Use the existing CRM task list for this opportunity. Completing a task
        does not automatically resolve a requirement.
      </p>
      <div className="service-actions">
        <Link
          className="crm-secondary-btn"
          to={`/crm/tasks?household=${record.household_id}&opportunity=${record.opportunity_id}`}
        >
          View opportunity tasks
        </Link>
        {active && (
          <Link
            className="crm-secondary-btn"
            to={`/crm/tasks?action=new&household=${record.household_id}&opportunity=${record.opportunity_id}`}
          >
            Create follow-up task
          </Link>
        )}
      </div>
    </section>
  )
}
function RequirementEditor({
  record,
  existing,
  assignees,
  owner,
  userId,
  cancel,
  done,
}: {
  record: ServiceRecord
  existing: CaseRequirement | null
  assignees: CaseAssignee[]
  owner: boolean
  userId: string
  cancel: () => void
  done: () => Promise<void>
}) {
  const [id] = useState(() => existing?.id ?? crypto.randomUUID())
  const [draft, setDraft] = useState({
    label: existing?.label ?? '',
    status: existing?.status ?? 'open',
    is_blocking: existing?.is_blocking ?? true,
    assigned_user_id: existing?.assigned_user_id ?? '',
    due_date: existing?.due_date ?? '',
    scheduled_for: existing?.scheduled_for ?? '',
  })
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false)
  useUnsavedChangesWarning(dirty)
  const statuses = existing
    ? requirementTransitions(existing.status)
    : (['open', 'scheduled'] as const)
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await client().rpc('save_service_requirement', {
        p_record: record.id,
        p_record_revision: record.revision,
        p_id: id,
        p_revision: existing?.revision ?? null,
        p_fields: {
          ...draft,
          assigned_user_id: draft.assigned_user_id || null,
          due_date: draft.due_date || null,
          scheduled_for: draft.scheduled_for || null,
        },
        p_reason: reason,
      })
      if (result.error) throw result.error
      setDirty(false)
      await done()
    } catch (e) {
      setError(serviceError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={save} onChange={() => setDirty(true)}>
      <fieldset disabled={busy}>
        <legend>{existing ? 'Update requirement' : 'New requirement'}</legend>
        {error && <p role="alert">{error}</p>}
        <div className="service-grid">
          <label>
            Requirement label
            <input
              required
              maxLength={120}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          <label>
            Requirement status
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as CaseRequirement['status'],
                })
              }
            >
              {statuses.map((v) => (
                <option key={v} value={v}>
                  {REQUIREMENT_STATUSES[v]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsible user
            <select
              value={draft.assigned_user_id}
              onChange={(e) =>
                setDraft({ ...draft, assigned_user_id: e.target.value })
              }
            >
              <option value="">Unassigned</option>
              {draft.assigned_user_id &&
                !assignees.some((a) => a.id === draft.assigned_user_id) && (
                  <option value={draft.assigned_user_id}>
                    User no longer eligible
                  </option>
                )}
              {assignees
                .filter(
                  (a) =>
                    owner ||
                    a.id === userId ||
                    a.id === existing?.assigned_user_id,
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Requirement due date
            <input
              type="date"
              value={draft.due_date}
              onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
            />
          </label>
          <label>
            Scheduled date
            <input
              type="date"
              required={draft.status === 'scheduled'}
              value={draft.scheduled_for}
              onChange={(e) =>
                setDraft({ ...draft, scheduled_for: e.target.value })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.is_blocking}
              onChange={(e) =>
                setDraft({ ...draft, is_blocking: e.target.checked })
              }
            />
            Must be resolved before completion
          </label>
          <label>
            Reason for requirement change
            <textarea
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
        <div className="service-actions">
          <button className="crm-primary-btn">
            {busy ? 'Saving…' : 'Save requirement'}
          </button>
          <button type="button" className="crm-secondary-btn" onClick={cancel}>
            Cancel requirement edit
          </button>
        </div>
      </fieldset>
    </form>
  )
}
