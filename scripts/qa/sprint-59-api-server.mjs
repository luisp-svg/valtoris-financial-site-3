/**
 * Local API shim for Sprint 5.8 Relationship Photo QA.
 * Extends 5.7 routes with relationship-photo + CRM document endpoints.
 */
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PORT = Number(process.env.QA59_API_PORT || 5181)
const VITE = process.env.QA59_VITE_ORIGIN || 'http://127.0.0.1:5174'
const ROOT = process.cwd()

async function bundleHandlers() {
  const outdir = mkdtempSync(join(ROOT, '.tmp-qa59-api-'))
  const entry = join(outdir, 'entry.mjs')
  writeFileSync(
    entry,
    `
export { handleDigitalIdentityConnectRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/connect.ts'))};
export { handleDigitalIdentityCardRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/card.ts'))};
export { handleDigitalIdentityVCardRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/card/vcard.ts'))};
export { handleDigitalIdentityQrRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/card/qr.ts'))};
export { handleDigitalIdentityRelationshipPhotoRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/relationship-photo.ts'))};
export { handleCrmDocumentSignedUrlRequest } from ${JSON.stringify(join(ROOT, 'api/crm/documents/signed-url.ts'))};
export { handleCrmRelationshipPhotoDeleteRequest } from ${JSON.stringify(join(ROOT, 'api/crm/documents/relationship-photo.ts'))};
`,
  )
  const outfile = join(outdir, 'handlers.mjs')
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    logLevel: 'silent',
  })
  process.on('exit', () => {
    try {
      rmSync(outdir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })
  return import(pathToFileURL(outfile).href)
}

function makeRes(nodeRes) {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v
      nodeRes.setHeader(k, v)
    },
    getHeader(k) {
      return nodeRes.getHeader(k)
    },
    status(code) {
      this.statusCode = code
      nodeRes.statusCode = code
      return this
    },
    json(payload) {
      if (!nodeRes.getHeader('content-type')) {
        nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      nodeRes.statusCode = this.statusCode
      nodeRes.end(JSON.stringify(payload))
      return this
    },
    end(chunk) {
      nodeRes.statusCode = this.statusCode
      nodeRes.end(chunk)
      return this
    },
    send(chunk) {
      return this.end(chunk)
    },
  }
  return res
}

async function readJsonBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks)
  if (!raw.length) return null
  return JSON.parse(raw.toString('utf8'))
}

function authCookieFromBearer(headers) {
  const auth = headers.authorization || headers.Authorization
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return headers.cookie || ''
  const accessToken = auth.slice('Bearer '.length).trim()
  if (!accessToken) return headers.cookie || ''
  const apiUrl = process.env.SUPABASE_URL || process.env.API_URL || 'http://127.0.0.1:54321'
  const ref = new URL(apiUrl).hostname.split('.')[0] || '127'
  const cookieName = `sb-${ref}-auth-token`
  const session = {
    access_token: accessToken,
    refresh_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }
  const encoded = encodeURIComponent(JSON.stringify(session))
  const existing = typeof headers.cookie === 'string' ? headers.cookie : ''
  return existing ? `${existing}; ${cookieName}=${encoded}` : `${cookieName}=${encoded}`
}

function toVercelReq(req, body, url) {
  const headers = { ...req.headers, cookie: authCookieFromBearer(req.headers) }
  return {
    method: req.method,
    headers,
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    socket: req.socket,
    url: url.pathname + url.search,
  }
}

async function proxyToVite(req, res, url) {
  const target = new URL(url.pathname + url.search, VITE)
  const headers = { ...req.headers, host: target.host }
  delete headers['content-length']
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    duplex: 'half',
    redirect: 'manual',
  }).catch((err) => {
    res.statusCode = 502
    res.end(`Vite proxy failed: ${err.message}`)
    return null
  })
  if (!upstream) return
  res.statusCode = upstream.status
  upstream.headers.forEach((v, k) => {
    if (k === 'transfer-encoding') return
    res.setHeader(k, v)
  })
  res.end(Buffer.from(await upstream.arrayBuffer()))
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  }
  const handlers = await bundleHandlers()
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
      const path = url.pathname
      if (path === '/api/digital-identity/connect') {
        const body = await readJsonBody(req)
        await handlers.handleDigitalIdentityConnectRequest(toVercelReq(req, body, url), makeRes(res))
        return
      }
      if (path === '/api/digital-identity/relationship-photo') {
        const body = await readJsonBody(req)
        await handlers.handleDigitalIdentityRelationshipPhotoRequest(
          toVercelReq(req, body, url),
          makeRes(res),
        )
        return
      }
      if (path === '/api/digital-identity/card') {
        await handlers.handleDigitalIdentityCardRequest(toVercelReq(req, null, url), makeRes(res))
        return
      }
      if (path === '/api/digital-identity/card/vcard') {
        await handlers.handleDigitalIdentityVCardRequest(toVercelReq(req, null, url), makeRes(res))
        return
      }
      if (path === '/api/digital-identity/card/qr') {
        await handlers.handleDigitalIdentityQrRequest(toVercelReq(req, null, url), makeRes(res))
        return
      }
      if (path === '/api/crm/documents/signed-url') {
        await handlers.handleCrmDocumentSignedUrlRequest(toVercelReq(req, null, url), makeRes(res))
        return
      }
      if (path === '/api/crm/documents/relationship-photo') {
        const body = await readJsonBody(req)
        await handlers.handleCrmRelationshipPhotoDeleteRequest(
          toVercelReq(req, body, url),
          makeRes(res),
        )
        return
      }
      if (path.startsWith('/api/')) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Not found in QA shim' }))
        return
      }
      await proxyToVite(req, res, url)
    } catch (err) {
      console.error('qa59 api error', err?.message || err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: 'Unable to process request' }))
      }
    }
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`QA59 API+proxy on http://127.0.0.1:${PORT} → ${VITE}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
