import {beforeEach,describe,expect,it,vi} from 'vitest'
import {createElement,isValidElement,type ReactElement,type ReactNode} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import type {CrmTask} from './types'

const ui=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,params:'',created:{} as CrmTask,failSave:false,fetch:vi.fn()}))
vi.mock('react',async original=>{
 const actual=await original<typeof import('react')>()
 return {...actual,
  // A deterministic hook harness lets the real form handler run without a DOM or network.
  useState:(initial:unknown)=>{
   const index=ui.cursor++
   if(!(index in ui.slots)){
    let value=typeof initial==='function'?(initial as ()=>unknown)():initial
    if(value && typeof value==='object' && 'household_id' in value && 'title' in value) value={...value,title:'New servicing task',household_id:'new-household'}
    if(index===8)value=false // task loading is complete before the user submits
    ui.slots[index]=value
   }
   return[ui.slots[index],(next:unknown)=>{ui.slots[index]=typeof next==='function'?(next as (v:unknown)=>unknown)(ui.slots[index]):next}]
  },
  useCallback:(fn:unknown)=>fn,useEffect:()=>{},useRef:(current:unknown)=>({current}),
 }
})
vi.mock('../auth/CrmAuthContext',()=>({useCrmAuth:()=>({role:'owner',profile:{id:'owner'}})}))
vi.mock('../../lib/supabase/client',()=>({createSupabaseBrowserClient:()=>({})}))
vi.mock('./TaskActions',()=>({default:()=>null}))
vi.mock('react-router-dom',()=>({
 Link:({to,children,...props}:{to:string;children:ReactNode})=>createElement('a',{...props,href:to},children),
 useSearchParams:()=>[new URLSearchParams(ui.params),(next:URLSearchParams)=>{ui.params=next.toString()}],
}))
vi.mock('./tasksApi',async original=>({
 ...await original<typeof import('./tasksApi')>(),
 createTask:async()=>{if(ui.failSave)throw Error('Save denied');return ui.created},
 fetchVisibleTasks:ui.fetch,
}))
import CrmTasksPage from '../../pages/crm/CrmTasksPage'
function findForm(node:ReactNode):ReactElement<{onSubmit:(event:{preventDefault:()=>void})=>Promise<void>}>|undefined{
 if(Array.isArray(node)){for(const child of node){const form=findForm(child);if(form)return form}}
 if(isValidElement<{children?:ReactNode}>(node)){if(node.type==='form')return node as ReturnType<typeof findForm>;return findForm(node.props.children)}
}
function page(){ui.cursor=0;return CrmTasksPage()}
async function submit(){const form=findForm(page());expect(form).toBeDefined();await form!.props.onSubmit({preventDefault:()=>{}});return renderToStaticMarkup(page())}
beforeEach(()=>{
 ui.slots=[];ui.cursor=0;ui.params='action=new';ui.failSave=false;ui.fetch.mockReset();ui.fetch.mockImplementation(async()=>[ui.created])
 ui.created={id:'new-task',household_id:'new-household',opportunity_id:null,title:'New servicing task',description:null,due_date:null,priority:'medium',status:'open',assigned_user_id:'owner',created_by_user_id:'owner',created_at:'',completed_at:null,deleted_at:null,source_type:'manual'}
})
describe('successful task creation navigation',()=>{
 it('reveals a newly saved manual task immediately from the default Sales view',async()=>{
  const html=await submit()
  expect(html).toContain('Task created.')
  expect(html).toContain('New servicing task')
  expect(html).not.toContain('No tasks in this view.')
  expect(new URLSearchParams(ui.params).get('queue')).toBe('operations')
  expect(new URLSearchParams(ui.params).get('task')).toBe('new-task')
 })
 it('removes incompatible status/date filters and updates stale household/opportunity scope',async()=>{
  ui.params='action=new&queue=internal&view=completed&due=overdue&household=old&opportunity=old&title=old'
  expect(await submit()).toContain('New servicing task')
  const params=new URLSearchParams(ui.params)
  for(const key of ['action','view','due','opportunity','title'])expect(params.has(key)).toBe(false)
  expect(params.get('household')).toBe('new-household')
  expect(params.get('queue')).toBe('operations')
 })
 it('reveals a saved diagnostic review in Internal rather than assuming all manual work is Operations',async()=>{
  ui.created={...ui.created,workflow_type:'review_initial_diagnostic',metadata:{contact_permission:false}}
  expect(await submit()).toContain('New servicing task')
  expect(new URLSearchParams(ui.params).get('queue')).toBe('internal')
 })
 it('does not turn a successful save into a submission failure by refreshing the previous scope',async()=>{
  ui.fetch.mockRejectedValue(Error('Previous list unavailable'))
  expect(await submit()).toContain('Task created.')
  expect(ui.fetch).not.toHaveBeenCalled()
 })
 it('keeps the form open and avoids navigation when the save fails',async()=>{
  ui.failSave=true
  const html=await submit()
  expect(html).toContain('Save denied')
  expect(html).not.toContain('Task created.')
  expect(new URLSearchParams(ui.params).get('action')).toBe('new')
  expect(new URLSearchParams(ui.params).has('task')).toBe(false)
 })
})
