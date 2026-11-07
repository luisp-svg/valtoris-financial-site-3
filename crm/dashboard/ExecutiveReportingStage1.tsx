import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { useCrmAuth } from '../auth/CrmAuthContext'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type TaskRow = { id: string; status: string; priority: string; due_date: string | null; assigned_user_id: string | null; metadata: Record<string, unknown> | null; workflow_type: string | null; source_type: string | null }
type OpportunityRow = { id: string; status: string; service_vertical_id: string | null }
type PolicyRow = { id: string; production_stage: string }
type VerticalRow = { id: string; name: string }


// Pages are ordered by stable UUID to avoid silent truncation at the Data API row limit.
// An error on any page invalidates the whole report rather than showing partial totals.
export async function fetchExecutiveRows<T>(
  db: SupabaseClient,
  table: 'tasks' | 'opportunities' | 'policy_applications' | 'service_verticals',
  columns: string,
  filter: 'active' | 'not_deleted' | 'active_verticals',
): Promise<T[]> {
  const pageSize = 200
  const all: T[] = []
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from(table).select(columns).order('id', { ascending: true }).range(offset, offset + pageSize - 1)
    if (filter === 'active') query = query.is('deleted_at', null).in('status', ['open', 'in_progress'])
    else if (filter === 'not_deleted') query = query.is('deleted_at', null)
    else query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) throw error
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < pageSize) return all
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = key(item)
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

export default function ExecutiveReportingStage1() {
  const { role } = useCrmAuth()
  const [data, setData] = useState<{ tasks: TaskRow[]; opportunities: OpportunityRow[]; policies: PolicyRow[]; verticals: VerticalRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (role !== 'owner') return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const db = createSupabaseBrowserClient()
        // Existing RLS remains authoritative. Never use a service key or a privileged reporting RPC.
        const [tasks, opportunities, policies, verticals] = await Promise.all([
          fetchExecutiveRows<TaskRow>(db, 'tasks', 'id,status,priority,due_date,assigned_user_id,metadata,workflow_type,source_type', 'active'),
          fetchExecutiveRows<OpportunityRow>(db, 'opportunities', 'id,status,service_vertical_id', 'not_deleted'),
          fetchExecutiveRows<PolicyRow>(db, 'policy_applications', 'id,production_stage', 'not_deleted'),
          fetchExecutiveRows<VerticalRow>(db, 'service_verticals', 'id,name', 'active_verticals'),
        ])
        if (!cancelled) setData({ tasks, opportunities, policies, verticals })
      } catch {
        if (!cancelled) { setData(null); setError('Executive reporting could not be loaded. No partial totals are shown.') }
      } finally { if (!cancelled) setLoading(false) }
    }
    void run()
    return () => { cancelled = true }
  }, [role])

  if (role !== 'owner') return null
  if (loading) return <section className="crm-panel"><p>Loading executive reporting…</p></section>
  if (error || !data) return <section className="crm-panel" role="alert"><p>{error ?? 'Reporting unavailable.'}</p></section>

  const today = new Date()
  const localToday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
  const { tasks, opportunities, policies, verticals } = data
  const active = opportunities.filter(row => row.status === 'open')
  const onHold = opportunities.filter(row => row.status === 'on_hold')
  const stageCounts = countBy(policies, row => row.production_stage)
  const names = new Map(verticals.map(row => [row.id, row.name]))
  const activeByDivision = countBy(active, row => names.get(row.service_vertical_id ?? '') ?? 'Unclassified')
  const operations = tasks.filter(row => row.source_type === 'manual' && row.workflow_type !== 'review_initial_diagnostic')
  const sales = tasks.filter(row => row.workflow_type === 'review_initial_diagnostic' && row.metadata?.contact_permission === true)
  const internalOnly = tasks.filter(row => !operations.some(op => op.id === row.id) && !sales.some(sale => sale.id === row.id))
  const metrics = [
    ['Open tasks', tasks.length],
    ['High-priority tasks', tasks.filter(row => row.priority === 'high' || row.priority === 'urgent').length],
    ['Unassigned tasks', tasks.filter(row => !row.assigned_user_id).length],
    ['Overdue tasks', tasks.filter(row => row.due_date && row.due_date < localToday).length],
    ['Active opportunities', active.length],
    ['On-hold opportunities', onHold.length],
    ['Issued / in-force applications', (stageCounts.issued ?? 0) + (stageCounts.in_force ?? 0)],
  ] as const
  return <section className="crm-panel" aria-labelledby="executive-reporting-heading">
    <div className="crm-panel-head"><div><h2 id="executive-reporting-heading">Executive reporting · Stage 1</h2><p className="crm-muted">Owner-only, read-only operational snapshot. Counts reflect records visible under TAC permissions.</p></div></div>
    <div className="crm-form-grid">{metrics.map(([label, value]) => <div key={label} className="crm-panel" style={{ padding: '1rem' }}><strong>{value}</strong><p className="crm-muted">{label}</p></div>)}</div>
    <h3>Action queues</h3>
    <p>Sales diagnostic reviews: <strong>{sales.length}</strong> · Internal reviews: <strong>{internalOnly.length}</strong> · Client operations: <strong>{operations.length}</strong></p>
    <p className="crm-muted">Contact permission on a submission is not sufficient proof of channel-specific marketing or SMS consent.</p>
    <p><Link to="/crm/tasks">Open TAC tasks</Link></p>
    <h3>Active pipeline by division</h3>
    {Object.keys(activeByDivision).length ? <ul>{Object.entries(activeByDivision).map(([name, count]) => <li key={name}>{name}: {count}</li>)}</ul> : <p className="crm-muted">No active opportunities.</p>}
    <h3>Policy application stages</h3>
    <ul>{Object.entries(stageCounts).sort(([a],[b]) => a.localeCompare(b)).map(([stage, count]) => <li key={stage}>{stage.replaceAll('_', ' ')}: {count}</li>)}</ul>
    <p className="crm-muted">Revenue and paid commissions are unavailable until verified financial sources are connected. Application counts are not revenue.</p>
  </section>
}
