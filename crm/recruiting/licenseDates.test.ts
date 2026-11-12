import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { licenseDateLabel, licenseDateToIso } from './licenseDates'
import { privateLicenseFields, credentialFields } from './formFields'
import RecruitForm from './RecruitForm'
describe('US licensing dates and driver issuing state',()=>{
 it('round-trips date-only values without timezone shifts',()=>{
  expect(licenseDateLabel('1990-01-02')).toBe('01/02/1990')
  expect(licenseDateToIso('01/02/1990')).toBe('1990-01-02')
  expect(licenseDateToIso('02/29/2024')).toBe('2024-02-29')
  expect(licenseDateToIso('')).toBe('')
 })
 it.each(['02/29/2025','02/30/2026','13/01/2026','00/10/2026','1/2/2026','2026-01-02'])('rejects invalid/ambiguous user date %s',value=>{
  expect(licenseDateToIso(value)).toBeNull()
 })
 it('renders date fields as MM/DD/YYYY and includes a required issuing-state selector',()=>{
  const html=renderToStaticMarkup(createElement(RecruitForm,{title:'Private licensing details',fields:privateLicenseFields,initial:{dob:'1990-01-02'},busy:false,onCancel:()=>{},onSubmit:async()=>{}}))
  expect(html).toContain('placeholder="MM/DD/YYYY"')
  expect(html).toContain('value="01/02/1990"')
  expect(html).toContain('Driver license issuing state / territory')
  expect(privateLicenseFields.find(f=>f.key==='drivers_license_state')).toMatchObject({required:true,options:expect.arrayContaining([{id:'TX',name:'Texas'}])})
  const license=renderToStaticMarkup(createElement(RecruitForm,{title:'License',fields:credentialFields('license'),initial:{effective_on:'2026-11-12'},busy:false,onCancel:()=>{},onSubmit:async()=>{}}))
  expect(license).toContain('value="11/12/2026"')
  expect(license).not.toContain('YYYY-MM-DD')
 })
})
