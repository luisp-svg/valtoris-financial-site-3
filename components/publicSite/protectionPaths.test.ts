import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {MemoryRouter} from 'react-router-dom'
import {describe,it,expect} from 'vitest'
import ProtectionAudiencePage from '../../pages/ProtectionAudiencePage'
import {readCardAttributionFromSearch} from '../reportCard/familyIngest/submissionSession'

describe('protection audience paths',()=>{
 it.each(['personal','private','business'] as const)('%s preserves language and campaign context into its focused assessment',audience=>{
  const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[`/${audience==='personal'?'personal-family':audience==='private'?'private-client':'business-owners'}?lang=es&utm_source=partner&card=referral`]},createElement(ProtectionAudiencePage,{audience})))
  expect(html).toContain('lang=es');expect(html).toContain('utm_source=partner');expect(html).toContain('card=referral');expect(html).toContain(`review_path=${audience}`)
  expect(html).toContain(audience==='business'?'focus=business':'focus=family')
  expect(html).toContain('Clearview');expect(html).toContain('resultados preliminares')
 })
 it('persists known audience paths into existing TAC source attribution without overriding referral sources',()=>{
  expect(readCardAttributionFromSearch('?review_path=personal').sourceChannel).toBe('valtoris_personal_family')
  expect(readCardAttributionFromSearch('?review_path=private').sourceChannel).toBe('valtoris_private_client')
  expect(readCardAttributionFromSearch('?review_path=business&src=partner').sourceChannel).toBe('partner')
  expect(readCardAttributionFromSearch('?review_path=https://evil.example').sourceChannel).toBeNull()
 })
})
