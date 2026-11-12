import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RecruitForm from './RecruitForm'
import CarrierStatuses from './CarrierStatuses'
import { createFields, editFields } from './formFields'
import { appointingOrganizations, appointingOrganizationsLabel, type Recruit, type CarrierReview } from './types'
import { retainedAgentFields } from './agentEditing'

describe('licensing acceptance form and carrier overview', () => {
 it('supports both organizations and keeps follow-up fields out of add/edit forms', () => {
  for (const fields of [createFields([]), editFields([])]) {
   expect(fields.find(field=>field.key==='appointing_organizations')).toMatchObject({type:'checkboxes',options:[{id:'empower',name:'Empower'},{id:'experior',name:'Experior'}]})
   expect(fields.some(field=>['assigned_advisor_id','next_action','next_action_due_on'].includes(field.key))).toBe(false)
  }
  const html = renderToStaticMarkup(createElement(RecruitForm,{title:'Edit agent',fields:editFields([]),initial:{appointing_organizations:['empower','experior']},busy:false,onCancel:()=>{},onSubmit:async()=>{}}))
  expect(html.match(/checked=""/g)).toHaveLength(2)
  expect(html).not.toContain('Reason for this change')
  expect(html).toContain('Cancel')
 })
 it('preserves legacy organizations, explicit cleared choices, and hidden historical follow-up values', () => {
  const record = {appointing_organization:'empower',assigned_advisor_id:'existing',next_action:'Keep this',next_action_due_on:'2026-12-01'} as Recruit
  expect(appointingOrganizations(record)).toEqual(['empower'])
  expect(appointingOrganizationsLabel({...record,appointing_organizations:['empower','experior']})).toBe('Empower, Experior')
  expect(appointingOrganizations({...record,appointing_organizations:[]})).toEqual([])
  expect(retainedAgentFields(record)).toEqual({assigned_advisor_id:'existing',next_action:'Keep this',next_action_due_on:'2026-12-01'})
 })
 it('shows every carrier, a clear unstarted status and a revoked code as revoked', () => {
  const reviews = [{id:'r',carrier_id:'a',state:'TX',authority_scope:'life',contract_progress:'code_issued',contract_status:'revoked',writing_code:'SYNTHETIC',appointment_status:'pending'}] as CarrierReview[]
  const props = {catalog:[{id:'a',name:'Carrier A'},{id:'b',name:'Carrier B'}],reviews,busy:false,onAdd:()=>{},onEdit:()=>{}}
  const manager = renderToStaticMarkup(createElement(CarrierStatuses,{...props,canManage:true}))
  expect(manager).toContain('Carrier A')
  expect(manager).toContain('Carrier B')
  expect(manager).toContain('Not started')
  expect(manager).toContain('Revoked')
  expect(manager).not.toContain('Code Issued')
  expect(manager).toContain('Update status for Carrier A')
  const advisor = renderToStaticMarkup(createElement(CarrierStatuses,{...props,canManage:false}))
  expect(advisor).not.toContain('<button')
 })
})
