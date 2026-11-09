import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import type { CrmTask } from './types'

const state = vi.hoisted(() => ({ rows: [] as unknown[], params: '', arrays: 0, effects: [] as Array<() => unknown> }))
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useEffect: (effect: () => unknown) => { state.effects.push(effect) }, useState: (initial: unknown) => {
    if (Array.isArray(initial) && state.arrays++ === 0) return actual.useState(state.rows)
    return actual.useState(initial === true ? false : initial)
  }}
})
vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react')
  return {
    Link: ({to, children, ...props}: {to:string;children:unknown}) => createElement('a', {...props, href:to}, children as string),
    useSearchParams: () => [new URLSearchParams(state.params), (next: URLSearchParams) => { state.params = next.toString() }],
    useNavigate: () => vi.fn(),
  }
})
vi.mock('../auth/CrmAuthContext', () => ({useCrmAuth: () => ({role:'owner',profile:{id:'owner'}})}))
vi.mock('../../lib/supabase/client', () => ({createSupabaseBrowserClient: () => {throw Error('Network access prohibited in review reproduction')}}))
import CrmTasksPage from '../../pages/crm/CrmTasksPage'
import CrmHomePage from '../../pages/crm/CrmHomePage'

const task = (id: string, overrides: Partial<CrmTask> = {}): CrmTask => ({id,household_id:'household',opportunity_id:null,title:`Title ${id}`,description:null,due_date:null,priority:'medium',status:'open',assigned_user_id:null,created_by_user_id:null,created_at:'',completed_at:null,deleted_at:null,source_type:'manual',...overrides})
function renderTasks(rows: CrmTask[], params: string) {state.rows=rows;state.params=params;state.arrays=0;state.effects=[];return renderToStaticMarkup(createElement(CrmTasksPage))}

describe('task deep links and dashboard navigation', () => {
 it.each(['operations', 'internal'])('opens a %s target without a queue parameter', queue => {
  const row=task('target',queue==='internal'?{workflow_type:'resolve_possible_duplicate'}:{})
  const html=renderTasks([row],'task=target')
  expect(html).toContain(row.title)
  expect(html).toContain('<details open=""')
  expect(html).not.toContain('No tasks in this view.')
  expect(html).toContain('queue='+queue)
 })
 it('honors the target queue even if an incoming link has a stale queue', () => {
  const row=task('target')
  expect(renderTasks([row],'task=target&queue=sales')).toContain(row.title)
 })
 it('lets explicit tab changes leave a deep-linked target and preserves household context', () => {
  const html=renderTasks([task('target')],'task=target&household=h')
  expect(html).toContain('href="/crm/tasks?household=h&amp;queue=sales"')
  expect(html).not.toContain('task=target')
 })
 it.each(['operations', 'internal'])('preserves the resolved %s queue after the deep-linked task completes', queue => {
  const row=task('target',queue==='internal'?{workflow_type:'resolve_possible_duplicate'}:{})
  renderTasks([row],'task=target&household=h')
  // Flush the real queue-persistence effect; network/form effects stay isolated.
  state.effects[1]()
  const persisted=state.params
  expect(new URLSearchParams(persisted).get('queue')).toBe(queue)
  expect(new URLSearchParams(persisted).get('household')).toBe('h')
  const html=renderTasks([],persisted)
  expect(html).toContain(`aria-current="page" href="/crm/tasks?household=h&amp;queue=${queue}"`)
 })
 it('marks only Executive reporting as current on the reporting view', () => {
  state.rows=[];state.params='view=reporting';state.arrays=0
  const html=renderToStaticMarkup(createElement(CrmHomePage))
  expect(html.match(/aria-current="page"/g)).toHaveLength(1)
  expect(html).toContain('aria-current="page" href="?view=reporting"')
 })
})
