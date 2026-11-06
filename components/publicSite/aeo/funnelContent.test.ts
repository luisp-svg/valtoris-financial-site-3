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
   const rewrite={source:FUNNEL_PATHS[priority],destination:`/funnel-entry/${priority}.html`}
   if (priority==='trucking') {
    expect(config.rewrites).toContainEqual(rewrite)
    expect(sitemap).not.toContain(`<loc>${entry.canonical}</loc>`)
    expect(config.headers).toContainEqual({source:FUNNEL_PATHS.trucking,headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]})
   } else {
    expect(config.rewrites).toContainEqual(rewrite)
    expect(sitemap).toContain(`<loc>${entry.canonical}</loc>`)
   }
   expect(entry.body).not.toContain(`href="${FUNNEL_PATHS.trucking}"`)
  }
 })
 it('redirects retired Report Cards to their replacements and removes their sitemap entries',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8')),sitemap=readFileSync('public/sitemap.xml','utf8')
  const retired = {
   '/personal-insurance-report-card':'/personal-insurance',
   '/lifestyle-report-card':'/personal-insurance',
   '/commercial-insurance-report-card':'/commercial-insurance',
   '/employee-benefits-report-card':'/business-report-card',
   '/tax-review-report-card':'/report-card',
   '/tax-planning-report-card':'/report-card',
   '/tsp-report-card':'/retirement-report-card',
   '/funnel-entry/lifestyle.html':'/personal-insurance',
   '/funnel-entry/commercial.html':'/commercial-insurance',
  }
  for (const [source,destination] of Object.entries(retired)) {
   expect(config.redirects).toContainEqual({source,destination,permanent:true})
   expect(sitemap).not.toContain(`${source}</loc>`)
   expect(Object.values(FUNNEL_PATHS)).not.toContain(source)
  }
  expect(config.redirects.some((redirect:{source:string})=>redirect.source===FUNNEL_PATHS.trucking)).toBe(false)
 })

})
