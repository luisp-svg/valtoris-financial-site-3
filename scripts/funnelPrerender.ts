import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { FUNNEL_PATHS, renderFunnelEntry, type DiscoverableFunnel } from '../components/publicSite/aeo/funnelContent'
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
export function funnelPrerender():Plugin{
 let outDir='dist'
 return {name:'valtoris-public-funnel-html',apply:'build',configResolved(config){outDir=resolve(config.root,config.build.outDir)},async closeBundle(){
  const shell=await readFile(resolve(outDir,'index.html'),'utf8');await mkdir(resolve(outDir,'funnel-entry'),{recursive:true})
  for(const type of Object.keys(FUNNEL_PATHS)as DiscoverableFunnel[]){
   const p=renderFunnelEntry(type)
   const html=shell.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(p.title)}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/>/,`<meta name="description" content="${escape(p.description)}" />`).replace('</head>',`<link rel="canonical" href="${p.canonical}" /><meta property="og:title" content="${escape(p.title)}" /><meta property="og:description" content="${escape(p.description)}" /><meta property="og:url" content="${p.canonical}" /><script type="application/ld+json" id="valtoris-funnel-prerender">${p.structuredData}</script></head>`).replace('<div id="root"></div>',`<div id="root">${p.body}</div>`)
   await writeFile(resolve(outDir,'funnel-entry',type+'.html'),html)
  }
 }}
}
