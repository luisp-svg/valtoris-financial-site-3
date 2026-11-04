import{describe,it,expect}from'vitest'
import{createElement}from'react'
import{renderToStaticMarkup}from'react-dom/server'
import{MemoryRouter}from'react-router-dom'
import{readFileSync}from'node:fs'
import FunnelAnswers from './FunnelAnswers'
import{funnelContent,FUNNEL_PATHS,renderFunnelEntry,type DiscoverableFunnel}from'./funnelContent'
describe('public funnel discovery',()=>{
 for(const priority of Object.keys(FUNNEL_PATHS)as DiscoverableFunnel[])for(const locale of ['en','es']as const)it(`${priority} ${locale} schema matches visible answer text`,()=>{
  const html=renderToStaticMarkup(createElement(MemoryRouter,{},createElement(FunnelAnswers,{priority,locale})))
  const json=html.match(/<script[^>]*data-valtoris-funnel[^>]*>([\s\S]*?)<\/script>/)![1]
  const faq=JSON.parse(json)['@graph'].find((n:Record<string,unknown>)=>n['@type']==='FAQPage')
  for(const [i,a]of funnelContent[priority][locale].answers.entries()){
   expect(html).toContain(renderToStaticMarkup(createElement('h3',{},a.question)))
   expect(html).toContain(renderToStaticMarkup(createElement('p',{},a.answer)))
   expect(faq.mainEntity[i]).toMatchObject({name:a.question,acceptedAnswer:{text:a.answer}})
  }
  expect(faq['@id']).not.toContain('utm_')
 })
 it('emits the same English answers without requiring JavaScript, with exact rewrites and sitemap entries',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8')),sitemap=readFileSync('public/sitemap.xml','utf8')
  for(const priority of Object.keys(FUNNEL_PATHS)as DiscoverableFunnel[]){
   const entry=renderFunnelEntry(priority)
   expect(entry.body).toContain('<h1>');expect(entry.body).toContain('Begin My Assessment')
   expect(JSON.parse(entry.structuredData)['@graph'][0].url).toBe(entry.canonical)
   expect(config.rewrites).toContainEqual({source:FUNNEL_PATHS[priority],destination:`/funnel-entry/${priority}.html`})
   expect(sitemap).toContain(`<loc>${entry.canonical}</loc>`)
  }
 })
})
