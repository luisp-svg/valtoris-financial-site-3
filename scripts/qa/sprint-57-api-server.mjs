/**
 * Local-only API shim for Sprint 5.7 browser QA.
 * Proxies /api/digital-identity/* to real handlers; other /api/* → 404;
 * everything else → Vite origin.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (local).
 */
import http from 'node:http'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PORT = Number(process.env.QA57_API_PORT || 5180)
const VITE = process.env.QA57_VITE_ORIGIN || 'http://127.0.0.1:5174'
const ROOT = process.cwd()

async function bundleHandlers() {
  const outdir = mkdtempSync(join(ROOT, '.tmp-qa57-api-'))
  const entry = join(outdir, 'entry.mjs')
  writeFileSync(
    entry,
    `
export { handleDigitalIdentityConnectRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/connect.ts'))};
export { handleDigitalIdentityCardRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/card.ts'))};
export { handleDigitalIdentityVCardRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/card/vcard.ts'))};
export { handleDigitalIdentityQrRequest } from ${JSON.stringify(join(ROOT, 'api/digital-identity/card/qr.ts'))};
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
  return import(pathToFileURL(outfile).href)
}

function makeRes(nodeRes) {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k] = v
      nodeRes.setHeader(k, v)
    },
    status(code) {
      this.statusCode = code
      nodeRes.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
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
      nodeRes.statusCode = this.statusCode
      nodeRes.end(chunk)
      return this
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

function toVercelReq(req, body, url) {
  const query = Object.fromEntries(url.searchParams.entries())
  return {
    method: req.method,
    headers: req.headers,
    body,
    query,
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
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.end(buf)
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  }
  if (
    !process.env.SUPABASE_URL.includes('127.0.0.1') &&
    !process.env.SUPABASE_URL.includes('localhost')
  ) {
    throw new Error('Refusing non-local SUPABASE_URL')
  }

  const handlers = await bundleHandlers()
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
      const path = url.pathname

      if (path === '/api/digital-identity/connect') {
        const body = await readJsonBody(req)
        const vReq = toVercelReq(req, body, url)
        const vRes = makeRes(res)
        await handlers.handleDigitalIdentityConnectRequest(vReq, vRes)
        return
      }
      if (path === '/api/digital-identity/card') {
        const vReq = toVercelReq(req, null, url)
        const vRes = makeRes(res)
        await handlers.handleDigitalIdentityCardRequest(vReq, vRes)
        return
      }
      if (path === '/api/digital-identity/card/vcard') {
        const vReq = toVercelReq(req, null, url)
        const vRes = makeRes(res)
        await handlers.handleDigitalIdentityVCardRequest(vReq, vRes)
        return
      }
      if (path === '/api/digital-identity/card/qr') {
        const vReq = toVercelReq(req, null, url)
        const vRes = makeRes(res)
        await handlers.handleDigitalIdentityQrRequest(vReq, vRes)
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
      console.error('qa57 api error', err?.message || err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: 'Unable to save submission' }))
      }
    }
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`QA57 API+proxy listening on http://127.0.0.1:${PORT} → vite ${VITE}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
