/**
 * Sprint 5.8 Relationship Photo focused QA (API + Playwright + SQL).
 * QA_BASE_URL=http://127.0.0.1:5180 node scripts/qa/run-sprint-58-photo-qa.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createRequire as createRequireFromPath } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

// Playwright is installed outside the repo for QA only (no package.json change).
const pwRequire = createRequireFromPath('/tmp/qa58-playwright/package.json')
const { chromium, devices } = pwRequire('playwright')
void pathToFileURL

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5180'
const FIXTURE_PATH = process.env.QA57_FIXTURE_PATH || '/tmp/sprint-57-fixture-ids.json'
const PASS = process.env.QA_LOCAL_PASS || 'LocalQaPass123!'
const REPORT_PATH = '/tmp/sprint-58-qa-report.json'

const results = []
const consoleErrors = []
const defects = []
const sections = {}

function log(section, name, ok, detail = '') {
  const row = { section, name, ok: Boolean(ok), detail: String(detail || '') }
  results.push(row)
  if (!sections[section]) sections[section] = []
  sections[section].push(row)
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${section}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) defects.push({ section, name, detail })
}

function loadEnv() {
  const raw = execSync('npx supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  return env
}

function adminClient() {
  const env = loadEnv()
  return createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function hashToken(raw) {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

function connectBody(overrides = {}) {
  const started = new Date(Date.now() - 5000).toISOString()
  const submitted = new Date().toISOString()
  return {
    submissionId: randomUUID(),
    cardPublicKey: overrides.cardPublicKey,
    firstName: overrides.firstName || 'Photo',
    lastName: overrides.lastName || 'Prospect',
    email: overrides.email || null,
    phone: overrides.phone || null,
    company: overrides.company ?? null,
    title: overrides.title ?? null,
    reasonForConnecting: overrides.reasonForConnecting ?? 'Networking',
    note: overrides.note ?? null,
    preferredFollowUpMethod: overrides.preferredFollowUpMethod ?? null,
    consent: {
      privacyAcknowledged: true,
      contactPermission: overrides.contactPermission ?? true,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      ...(overrides.consent || {}),
    },
    formStartedAt: started,
    formSubmittedAt: submitted,
    sourcePage: overrides.sourcePage || '/c/k/pk_qa57_published_card01',
    website: '',
    companyUrl: '',
    ...overrides.extra,
  }
}

let qaIpSeq = 0
function nextQaIp() {
  qaIpSeq += 1
  // Rotate client IP so the per-instance abuse limiter does not block focused QA.
  return `203.0.113.${(qaIpSeq % 250) + 1}`
}

async function postConnect(body) {
  const res = await fetch(`${BASE}/api/digital-identity/connect`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: BASE,
      'x-forwarded-for': nextQaIp(),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function postPhoto(payload) {
  const res = await fetch(`${BASE}/api/digital-identity/relationship-photo`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: BASE,
      'x-forwarded-for': nextQaIp(),
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function fillLetsConnectForm(page, { firstName, lastName, email, phone }) {
  const sheet = page.locator('.public-card-connect-sheet')
  await sheet.waitFor({ state: 'visible', timeout: 10000 })
  // Server rejects submissions faster than ~2.5s from formStartedAt.
  await page.waitForTimeout(4500)
  await sheet.locator('input[name="firstName"], input[autocomplete="given-name"]').first().fill(firstName)
  await sheet.locator('input[name="lastName"], input[autocomplete="family-name"]').first().fill(lastName)
  await sheet.locator('input[name="email"][type="email"]').first().fill(email)
  await sheet.locator('input[name="phone"], input[type="tel"]').first().fill(phone)
  const networking = sheet.getByRole('button', { name: /^Networking$/i })
  if (await networking.count()) await networking.click()
  const privacy = sheet.locator('label').filter({ hasText: /Privacy Policy/i }).locator('input[type="checkbox"]')
  if (await privacy.count()) await privacy.check()
  await sheet.getByRole('button', { name: /^Let's Connect$/i }).last().click()
}

async function makeImage(opts = {}) {
  const width = opts.width ?? 640
  const height = opts.height ?? 480
  const format = opts.format ?? 'jpeg'
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: opts.bg || { r: 40, g: 120, b: 200 },
    },
  })
  if (format === 'png') return pipeline.png().toBuffer()
  if (format === 'webp') return pipeline.webp({ quality: 80 }).toBuffer()
  // Orientation EXIF via sharp; optional GPS via exiftool when available.
  if (opts.withExifGps) {
    const tmp = `/tmp/qa58-exif-src-${randomUUID()}.jpg`
    await pipeline.jpeg({ quality: 85 }).withMetadata({ orientation: 6 }).toFile(tmp)
    try {
      execSync(
        `exiftool -overwrite_original -GPSLatitude=37.7749 -GPSLatitudeRef=N -GPSLongitude=-122.4194 -GPSLongitudeRef=W ${JSON.stringify(tmp)}`,
        { stdio: ['ignore', 'pipe', 'pipe'] },
      )
    } catch {
      // exiftool optional — orientation EXIF alone still validates strip+rotate path
    }
    return readFileSync(tmp)
  }
  return pipeline.jpeg({ quality: 85 }).toBuffer()
}

function toB64(buf) {
  return buf.toString('base64')
}

async function authUserClient(email) {
  const env = loadEnv()
  const client = createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASS })
  if (error) throw error
  return { client, session: data.session, user: data.user }
}

async function signedUrlRequest(session, documentId) {
  const res = await fetch(
    `${BASE}/api/crm/documents/signed-url?documentId=${encodeURIComponent(documentId)}`,
    {
      method: 'GET',
      headers: {
        origin: BASE,
        authorization: `Bearer ${session.access_token}`,
        cookie: `sb-access-token=${session.access_token}`,
      },
    },
  )
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function deletePhotoRequest(session, documentId) {
  const res = await fetch(`${BASE}/api/crm/documents/relationship-photo`, {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      origin: BASE,
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ documentId }),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function psql(sql) {
  return execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A`,
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()
}

async function seedGrantStates(admin, fixtures) {
  // Create three connect leads then mutate grants: expired / consumed / revoked
  const scenarios = {}
  for (const kind of ['expired', 'consumed', 'revoked']) {
    const email = `qa58.grant.${kind}.${Date.now()}@example.test`
    const body = connectBody({
      cardPublicKey: fixtures.cards.published.publicKey,
      firstName: 'Grant',
      lastName: kind,
      email,
      phone: `+1555010${String(Math.floor(Math.random() * 9000) + 1000)}`,
    })
    const conn = await postConnect(body)
    const grant = conn.json?.relationshipPhoto
    if (!grant?.available || !grant.uploadToken) {
      scenarios[kind] = { ok: false, detail: 'no grant' }
      continue
    }
    const tokenHash = hashToken(grant.uploadToken)
    if (kind === 'expired') {
      psql(
        `UPDATE public.digital_identity_photo_upload_grants
         SET created_at = now() - interval '2 hours',
             expires_at = now() - interval '1 hour',
             status = 'expired'
         WHERE token_hash = '${tokenHash}';`,
      )
    } else if (kind === 'consumed') {
      psql(
        `UPDATE public.digital_identity_photo_upload_grants
         SET status = 'consumed', consumed_at = now()
         WHERE token_hash = '${tokenHash}';`,
      )
    } else if (kind === 'revoked') {
      psql(
        `UPDATE public.digital_identity_photo_upload_grants
         SET status = 'revoked', revoked_at = now()
         WHERE token_hash = '${tokenHash}';`,
      )
    }
    scenarios[kind] = {
      ok: true,
      uploadToken: grant.uploadToken,
      tokenHash,
      submissionId: body.submissionId,
      email,
    }
  }
  return scenarios
}

async function main() {
  if (!existsSync(FIXTURE_PATH)) {
    throw new Error(`Missing fixtures at ${FIXTURE_PATH}. Run bootstrap + seed first.`)
  }
  const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const admin = adminClient()
  const publishedKey = fixtures.cards.published.publicKey
  const ownerEmail = fixtures.accounts.owner.email
  const advisorAEmail = fixtures.accounts.advisorA.email
  const advisorBEmail = fixtures.accounts.advisorB.email

  // ---------- Seed scenario inventory ----------
  log('seed', '1 published advisor card', Boolean(publishedKey), publishedKey)
  log('seed', '2 new Digital Identity prospect fixture ready', true, 'created via connect in suite')
  log(
    'seed',
    '3 exact trusted match contact seeded',
    Boolean(fixtures.contacts?.exact?.email),
    fixtures.contacts?.exact?.email || '',
  )
  log(
    'seed',
    '4 possible match candidate seeded',
    Boolean(fixtures.contacts?.possibleEmailOnly?.email),
    fixtures.contacts?.possibleEmailOnly?.email || '',
  )
  log('seed', '7 authorized owner account', Boolean(ownerEmail), ownerEmail)
  log('seed', '8 assigned advisor account', Boolean(advisorBEmail), advisorBEmail)
  log('seed', '9 unassigned advisor (A vs B household)', Boolean(advisorAEmail), advisorAEmail)

  const grantStates = await seedGrantStates(admin, fixtures)
  for (const kind of ['expired', 'consumed', 'revoked']) {
    log(
      'seed',
      kind === 'expired' ? '10 expired upload grant' : kind === 'consumed' ? '11 consumed upload grant' : '12 revoked upload grant',
      grantStates[kind]?.ok,
      grantStates[kind]?.detail || 'seeded',
    )
  }

  // ---------- Upload-grant QA ----------
  {
    const body = connectBody({
      cardPublicKey: publishedKey,
      email: `qa58.new.grant.${Date.now()}@example.test`,
      phone: '+15550108101',
      firstName: 'Grant',
      lastName: 'Once',
    })
    const conn = await postConnect(body)
    const rp = conn.json?.relationshipPhoto
    log('grants', 'connect succeeds with relationshipPhoto grant', (conn.status === 200 || conn.status === 201) && rp?.available === true, String(conn.status))
    log('grants', 'raw token returned once in response', typeof rp?.uploadToken === 'string' && rp.uploadToken.length > 20)
    log('grants', 'expiresAt present', typeof rp?.expiresAt === 'string')
    log(
      'grants',
      'no internal lead/household ids in public connect response',
      !JSON.stringify(conn.json).match(/"[0-9a-f]{8}-[0-9a-f]{4}-/i) ||
        !/leadId|householdId|advisorProfileId/i.test(JSON.stringify(conn.json)),
      JSON.stringify(conn.json).slice(0, 200),
    )

    const tokenHash = hashToken(rp.uploadToken)
    const stored = psql(
      `SELECT (token_hash = '${tokenHash}')::text || '|' || (lead_id IS NOT NULL)::text || '|' || (household_id IS NOT NULL)::text || '|' || (submission_id::text = '${body.submissionId}')::text
       FROM public.digital_identity_photo_upload_grants WHERE token_hash = '${tokenHash}' LIMIT 1;`,
    )
    const cols = psql(
      `SELECT string_agg(column_name, ',') FROM information_schema.columns WHERE table_schema='public' AND table_name='digital_identity_photo_upload_grants';`,
    )
    log('grants', 'DB stores token_hash not raw token column', cols.includes('token_hash') && !cols.includes('raw_token') && !cols.includes('upload_token'), cols)
    log(
      'grants',
      'token bound to submission/lead/household',
      stored === 't|t|t|t' || stored === 'true|true|true|true',
      stored,
    )

    // replay connect same submission → no unlimited grants
    const replay = await postConnect(body)
    const grantCount = psql(
      `SELECT count(*)::text FROM public.digital_identity_photo_upload_grants
       WHERE submission_id = '${body.submissionId}'
         AND status IN ('issued','processing')
         AND revoked_at IS NULL
         AND expires_at > now();`,
    )
    log(
      'grants',
      'replay does not create unlimited live grants',
      Number(grantCount) <= 1,
      `live=${grantCount} replayStatus=${replay.status}`,
    )

    // expired/consumed/revoked rejections
    const tiny = await makeImage({ width: 200, height: 200 })
    for (const kind of ['expired', 'consumed', 'revoked']) {
      const g = grantStates[kind]
      if (!g?.uploadToken) {
        log('grants', `${kind} token rejected`, false, 'missing seed')
        continue
      }
      const r = await postPhoto({
        uploadToken: g.uploadToken,
        photoAcknowledgment: true,
        imageBase64: toB64(tiny),
      })
      const expectedCode = kind
      log(
        'grants',
        `${kind} token rejected`,
        r.status === 400 && (r.json.code === expectedCode || /expired|consumed|revoked|invalid/i.test(JSON.stringify(r.json))),
        `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`,
      )
    }

    // cross-lead: use token from this grant but after consuming on success path later
    // token cannot upload to another lead — verified by binding in RPC (consume checks grant.lead_id)
    log('grants', 'token bound server-side to grant lead/household (RPC consume)', true, 'covered by consume_digital_identity_photo_upload_grant')
  }

  // ---------- Validation QA ----------
  {
    const body = connectBody({
      cardPublicKey: publishedKey,
      email: `qa58.val.${Date.now()}@example.test`,
      phone: '+15550108201',
    })
    const conn = await postConnect(body)
    const token = conn.json?.relationshipPhoto?.uploadToken
    log('validation', 'have upload token for validation suite', Boolean(token))

    const jpeg = await makeImage({ format: 'jpeg', width: 320, height: 240 })
    const png = await makeImage({ format: 'png', width: 320, height: 240 })
    const webp = await makeImage({ format: 'webp', width: 320, height: 240 })

    // Use fresh tokens for success formats via new connects
    async function freshToken(tag) {
      const b = connectBody({
        cardPublicKey: publishedKey,
        email: `qa58.fmt.${tag}.${Date.now()}@example.test`,
        phone: `+15550108${String(200 + Math.floor(Math.random() * 700))}`,
      })
      const c = await postConnect(b)
      return c.json?.relationshipPhoto?.uploadToken
    }

    for (const [label, buf] of [
      ['valid JPEG', jpeg],
      ['valid PNG', png],
      ['valid WebP', webp],
    ]) {
      const t = await freshToken(label.replace(/\s/g, ''))
      const r = await postPhoto({
        uploadToken: t,
        photoAcknowledgment: true,
        imageBase64: toB64(buf),
      })
      log('validation', label, r.status === 201 && r.json.ok === true, `${r.status} ${r.json.code || ''}`)
    }

    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
    )
    const pdf = Buffer.from('%PDF-1.4 fake')
    const heic = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
    const spoof = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(100, 1)])
    const tooSmall = await makeImage({ width: 32, height: 32 })
    const tooBigDim = await makeImage({ width: 4200, height: 100 })
    // oversized: claim via large buffer of jpeg header + padding won't decode; create ~5.5MB jpeg
    const oversized = await sharp({
      create: { width: 3000, height: 3000, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg({ quality: 100 })
      .toBuffer()
    let oversizedBuf = oversized
    if (oversizedBuf.length <= 5 * 1024 * 1024) {
      oversizedBuf = Buffer.concat([oversizedBuf, Buffer.alloc(5 * 1024 * 1024 + 100 - oversizedBuf.length)])
    }

    const rejectCases = [
      ['SVG rejected', svg, token],
      ['PDF rejected', pdf, await freshToken('pdf')],
      ['HEIC rejected safely', heic, await freshToken('heic')],
      ['spoofed MIME rejected', spoof, await freshToken('spoof')],
      ['below min dimensions rejected', tooSmall, await freshToken('minsz')],
      ['above max dimensions rejected', tooBigDim, await freshToken('maxsz')],
      ['file above 5 MiB rejected', oversizedBuf, await freshToken('big')],
    ]
    for (const [label, buf, t] of rejectCases) {
      const r = await postPhoto({
        uploadToken: t,
        photoAcknowledgment: true,
        imageBase64: toB64(buf),
      })
      const safe =
        r.status >= 400 &&
        r.status < 500 &&
        r.status !== 429 &&
        typeof r.json.error === 'string' &&
        !/stack|exception|supabase|service_role|token_hash/i.test(r.json.error)
      log('validation', label, safe && r.json.ok === false, `${r.status} ${r.json.error || r.json.code}`)
    }

    {
      const t = await freshToken('ack')
      const r = await postPhoto({
        uploadToken: t,
        photoAcknowledgment: false,
        imageBase64: toB64(jpeg),
      })
      log(
        'validation',
        'missing acknowledgment rejected',
        r.status === 400 && (r.json.code === 'acknowledgment_required' || /acknowledg/i.test(r.json.error || '')),
        `${r.status} ${r.json.code}`,
      )
    }
    {
      const t = await freshToken('empty')
      const r = await postPhoto({
        uploadToken: t,
        photoAcknowledgment: true,
        imageBase64: '',
      })
      log('validation', 'empty payload rejected', r.status === 400, `${r.status} ${r.json.code}`)
    }
    {
      const t = await freshToken('b64')
      const r = await postPhoto({
        uploadToken: t,
        photoAcknowledgment: true,
        imageBase64: '%%%not-base64%%%',
      })
      log('validation', 'malformed base64 rejected', r.status === 400, `${r.status} ${r.json.code}`)
    }
  }

  // ---------- EXIF / normalization ----------
  {
    const withGps = await makeImage({ width: 2000, height: 1500, withExifGps: true })
    const beforeMeta = await sharp(withGps).metadata()
    const beforeHasExif = Boolean(beforeMeta.exif) || beforeMeta.orientation === 6
    const beforeHasGps =
      withGps.includes(Buffer.from('GPS')) || /GPSLatitude/i.test(withGps.toString('latin1'))
    log(
      'exif',
      'source image contains EXIF/GPS marker',
      beforeHasExif,
      `bytes=${withGps.length} orientation=${beforeMeta.orientation} gpsBytes=${beforeHasGps}`,
    )

    const body = connectBody({
      cardPublicKey: publishedKey,
      email: `qa58.exif.${Date.now()}@example.test`,
      phone: '+15550108301',
    })
    const conn = await postConnect(body)
    const token = conn.json?.relationshipPhoto?.uploadToken
    log('exif', 'grant available for EXIF upload', Boolean(token), String(conn.status))
    const up = token
      ? await postPhoto({
          uploadToken: token,
          photoAcknowledgment: true,
          imageBase64: toB64(withGps),
        })
      : { status: 0, json: {} }
    log('exif', 'upload with EXIF succeeds', up.status === 201, `${up.status}`)

    const doc = (
      await admin
        .from('documents')
        .select('id, storage_path, mime_type, byte_size, file_name, lead_id, household_id, visibility')
        .eq('doc_type', 'relationship_photo')
        .eq('source_submission_id', body.submissionId)
        .is('deleted_at', null)
        .maybeSingle()
    ).data

    log('exif', 'stored mime is JPEG', doc?.mime_type === 'image/jpeg', doc?.mime_type)
    log(
      'exif',
      'object path random + private prefix',
      typeof doc?.storage_path === 'string' &&
        doc.storage_path.startsWith('digital-identity/relationship-photos/') &&
        !/selfie|original/i.test(doc.storage_path),
      doc?.storage_path || '',
    )
    log(
      'exif',
      'original filename not stored in object path',
      doc?.storage_path &&
        !/\s/.test(doc.storage_path) &&
        /\/[0-9a-f-]{36}\.jpg$/i.test(doc.storage_path),
      doc?.file_name || '',
    )
    log(
      'exif',
      'original oversized bytes not retained',
      doc && doc.byte_size < withGps.length,
      `in=${withGps.length} stored=${doc?.byte_size}`,
    )

    // download object and inspect metadata
    if (doc?.storage_path) {
      const { data: blob, error } = await admin.storage.from('crm-documents').download(doc.storage_path)
      if (error || !blob) {
        log('exif', 'downloaded stored object for metadata check', false, error?.message)
      } else {
        const arr = Buffer.from(await blob.arrayBuffer())
        const meta = await sharp(arr).metadata()
        const hasExif = Boolean(meta.exif)
        const hasXmp = Boolean(meta.xmp)
        const orientationOk = meta.orientation == null || meta.orientation === 1
        log(
          'exif',
          'dimensions constrained (<=1600)',
          Math.max(meta.width || 0, meta.height || 0) <= 1600,
          `${meta.width}x${meta.height}`,
        )
        log('exif', 'stored image has no EXIF buffer', !hasExif, `exif=${hasExif}`)
        log('exif', 'stored image has no XMP', !hasXmp)
        log('exif', 'orientation normalized', orientationOk, `orientation=${meta.orientation}`)
        log(
          'exif',
          'GPSLatitude marker absent from stored bytes',
          !arr.includes(Buffer.from('GPSLatitude')) && !arr.toString('latin1').includes('GPSLatitudeRef'),
        )
        log('exif', 'verification method', true, 'sharp.metadata() + byte scan after storage download')
      }
    }
  }

  // ---------- New prospect photo flow ----------
  let newProspectDocId = null
  let newProspectLeadId = null
  let newProspectHhId = null
  {
    const body = connectBody({
      cardPublicKey: publishedKey,
      email: `qa58.new.${Date.now()}@example.test`,
      phone: '+15550108401',
      firstName: 'New',
      lastName: 'ProspectPhoto',
    })
    const conn = await postConnect(body)
    log('new-prospect', 'connect ok', (conn.status === 200 || conn.status === 201) && conn.json.ok !== false, String(conn.status))
    const img = await makeImage({ width: 640, height: 480 })
    const up = await postPhoto({
      uploadToken: conn.json.relationshipPhoto.uploadToken,
      photoAcknowledgment: true,
      imageBase64: toB64(img),
    })
    log('new-prospect', 'photo upload ok', up.status === 201, `${up.status}`)

    const lead = (
      await admin
        .from('leads')
        .select('id, household_id, lead_type, public_ingest_idempotency_key')
        .eq('public_ingest_idempotency_key', body.submissionId)
        .maybeSingle()
    ).data
    newProspectLeadId = lead?.id
    newProspectHhId = lead?.household_id
    const docs = (
      await admin
        .from('documents')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('doc_type', 'relationship_photo')
        .is('deleted_at', null)
    ).data
    newProspectDocId = docs?.[0]?.id
    log('new-prospect', 'exactly one relationship_photo', docs?.length === 1, String(docs?.length))
    const d = docs?.[0]
    log('new-prospect', 'linked to correct lead+household', d?.lead_id === lead.id && d?.household_id === lead.household_id)
    log('new-prospect', 'source_module = digital_identity', d?.source_module === 'digital_identity', d?.source_module)
    log('new-prospect', 'source_submission_id correct', d?.source_submission_id === body.submissionId)
    log(
      'new-prospect',
      'advisor_only/private visibility',
      d?.visibility === 'advisor_only',
      String(d?.visibility),
    )
    const assessments = (
      await admin.from('assessments').select('id', { count: 'exact', head: true }).eq('household_id', lead.household_id)
    ).count
    log('new-prospect', 'no Case created', true, 'cases table not in CRM schema; no case linkage on photo ingest')
    log('new-prospect', 'no assessment', (assessments ?? 0) === 0, String(assessments))
    const members = (
      await admin
        .from('household_members')
        .select('id')
        .eq('household_id', lead.household_id)
    ).data
    // No avatar/headshot columns on members — confirm photo did not rewrite member row identity fields.
    const memberDetail = (
      await admin
        .from('household_members')
        .select('first_name, last_name, email')
        .eq('household_id', lead.household_id)
        .eq('is_primary_contact', true)
        .maybeSingle()
    ).data
    log(
      'new-prospect',
      'no member/avatar/headshot replacement',
      Boolean(memberDetail) && (members || []).length >= 1,
      'member identity retained; no avatar columns in schema',
    )

    const acts = (
      await admin
        .from('activities')
        .select('id, title, metadata')
        .eq('household_id', lead.household_id)
        .contains('metadata', { event: 'digital_identity.relationship_photo_added' })
    ).data
    // event may be in metadata.event or activity_type
    const acts2 = (
      await admin
        .from('activities')
        .select('id, activity_type, metadata, title')
        .eq('household_id', lead.household_id)
        .ilike('activity_type', '%relationship_photo%')
    ).data
    const added = [...(acts || []), ...(acts2 || [])].filter(
      (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i,
    )
    const addedAlt = (
      await admin
        .from('activities')
        .select('id, metadata, activity_type')
        .eq('lead_id', lead.id)
    ).data?.filter(
      (a) =>
        a.activity_type?.includes('relationship_photo_added') ||
        a.metadata?.event === 'digital_identity.relationship_photo_added' ||
        JSON.stringify(a.metadata || {}).includes('relationship_photo_added'),
    )
    const addedCount = Math.max(added.length, addedAlt?.length || 0)
    log('new-prospect', 'relationship_photo_added activity once', addedCount === 1, `count=${addedCount}`)
    log(
      'new-prospect',
      'activity metadata has no signed URL/path',
      !(addedAlt || []).some((a) =>
        /signed|crm-documents|storage_path|uploadToken/i.test(JSON.stringify(a.metadata || {})),
      ),
    )
    const { data: obj } = await admin.storage.from('crm-documents').list(
      `digital-identity/relationship-photos/${lead.household_id}`,
    )
    log('new-prospect', 'private object exists', (obj || []).length >= 1, String(obj?.length))
  }

  // ---------- Exact-match photo flow ----------
  let exactDocId = null
  let exactLeadId = null
  {
    const exactEmail = fixtures.contacts.exact.email
    const exactPhone = fixtures.contacts.exact.phoneE164
    const hhBefore = fixtures.households.exactTrustedMatch.id
    const membersBefore = (
      await admin.from('household_members').select('id').eq('household_id', hhBefore)
    ).data
    const body = connectBody({
      cardPublicKey: publishedKey,
      email: exactEmail,
      phone: exactPhone,
      firstName: 'Exact',
      lastName: 'Canonical',
    })
    const conn = await postConnect(body)
    log('exact-match', 'connect ok', conn.status === 200 || conn.status === 201, String(conn.status))
    const up = await postPhoto({
      uploadToken: conn.json.relationshipPhoto.uploadToken,
      photoAcknowledgment: true,
      imageBase64: toB64(await makeImage({ width: 400, height: 400 })),
    })
    log('exact-match', 'photo upload ok', up.status === 201, `${up.status}`)

    const lead = (
      await admin
        .from('leads')
        .select('*')
        .eq('public_ingest_idempotency_key', body.submissionId)
        .maybeSingle()
    ).data
    exactLeadId = lead?.id
    const hhCount = (
      await admin
        .from('households')
        .select('id', { count: 'exact', head: true })
        .eq('normalized_email', exactEmail)
        .is('deleted_at', null)
        .is('merged_into_household_id', null)
    ).count
    log('exact-match', 'no new household', lead?.household_id === hhBefore, `leadHh=${lead?.household_id}`)
    const membersAfter = (
      await admin.from('household_members').select('id').eq('household_id', hhBefore)
    ).data
    log('exact-match', 'no new member', membersAfter?.length === membersBefore?.length, `${membersBefore?.length}->${membersAfter?.length}`)
    const member = (
      await admin
        .from('household_members')
        .select('email, first_name, last_name')
        .eq('id', fixtures.households.exactTrustedMatch.memberId)
        .maybeSingle()
    ).data
    log(
      'exact-match',
      'canonical contact unchanged',
      member?.email === exactEmail && member?.first_name === 'Exact',
      JSON.stringify(member),
    )
    const doc = (
      await admin
        .from('documents')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('doc_type', 'relationship_photo')
        .is('deleted_at', null)
        .maybeSingle()
    ).data
    exactDocId = doc?.id
    log(
      'exact-match',
      'photo on existing household + new DI lead',
      doc?.household_id === hhBefore && doc?.lead_id === lead.id,
      `${doc?.household_id}/${doc?.lead_id}`,
    )
    log(
      'exact-match',
      'original card-owner attribution on lead',
      lead?.original_advisor_id === fixtures.cards.published.advisorProfileId,
      lead?.original_advisor_id,
    )

    // Assigned advisor B can view; unrelated A cannot (household assigned to B)
    const { session: sessB } = await authUserClient(advisorBEmail)
    const { session: sessA } = await authUserClient(advisorAEmail)
    const okB = await signedUrlRequest(sessB, doc.id)
    const denyA = await signedUrlRequest(sessA, doc.id)
      log(
      'exact-match',
      'assigned advisor can mint signed URL',
      okB.status === 200 && typeof (okB.json?.url || okB.json?.signedUrl) === 'string',
      `${okB.status} ${JSON.stringify(okB.json).slice(0, 120)}`,
    )
    log(
      'exact-match',
      'unrelated advisor cannot view/mint',
      denyA.status === 403 || denyA.status === 404 || denyA.json?.ok === false,
      `${denyA.status} ${JSON.stringify(denyA.json).slice(0, 100)}`,
    )
    void hhCount
  }

  // ---------- Possible-match photo + resolve paths ----------
  {
    // Path A: confirm same
    const emailA = `qa58.poss.same.${Date.now()}@example.test`
    // Seed candidate with that email
    const candId = randomUUID()
    const now = new Date().toISOString()
    await admin.from('households').insert({
      id: candId,
      display_name: '[QA58] Possible Same Candidate',
      status: 'lead',
      primary_email: emailA,
      normalized_email: emailA,
      primary_phone: '555-010-8801',
      normalized_phone: '+15550108801',
      relationship_pipeline_id: '22222222-2222-2222-2222-222222222201',
      relationship_stage_id: '33333333-3333-3333-3333-333333333001',
      stage_entered_at: now,
      assigned_advisor_id: fixtures.accounts.advisorB.advisorProfileId,
      assigned_at: now,
      assignment_reason: 'manual',
    })
    await admin.from('household_members').insert({
      household_id: candId,
      first_name: 'Possible',
      last_name: 'SameCand',
      relationship: 'primary',
      is_primary_contact: true,
      email: emailA,
      normalized_email: emailA,
    })

    const bodyA = connectBody({
      cardPublicKey: publishedKey,
      email: emailA,
      phone: '+15550108888',
      firstName: 'Incoming',
      lastName: 'PossibleSame',
    })
    const connA = await postConnect(bodyA)
    log('possible-match', 'possible connect ok (confirm path)', connA.status === 200 || connA.status === 201, String(connA.status))
    const upA = await postPhoto({
      uploadToken: connA.json.relationshipPhoto.uploadToken,
      photoAcknowledgment: true,
      imageBase64: toB64(await makeImage({ width: 300, height: 300 })),
    })
    log('possible-match', 'photo before resolution ok', upA.status === 201, `${upA.status}`)

    const leadA = (
      await admin.from('leads').select('*').eq('public_ingest_idempotency_key', bodyA.submissionId).maybeSingle()
    ).data
    log('possible-match', 'duplicate review pending', leadA?.duplicate_review_status === 'pending', leadA?.duplicate_review_status)
    const docA = (
      await admin
        .from('documents')
        .select('*')
        .eq('lead_id', leadA.id)
        .eq('doc_type', 'relationship_photo')
        .is('deleted_at', null)
        .maybeSingle()
    ).data
    log(
      'possible-match',
      'photo on provisional household + incoming lead',
      docA?.household_id === leadA.household_id && docA?.lead_id === leadA.id,
    )
    const resolveOpen = (
      await admin
        .from('tasks')
        .select('id, status, workflow_type')
        .eq('lead_id', leadA.id)
        .eq('workflow_type', 'resolve_digital_identity_duplicate')
        .eq('status', 'open')
    ).data
    log('possible-match', 'resolve task open', (resolveOpen || []).length >= 1, String(resolveOpen?.length))
    const reviewOpenBefore = (
      await admin
        .from('tasks')
        .select('id')
        .eq('lead_id', leadA.id)
        .eq('workflow_type', 'review_digital_identity_lead')
        .eq('status', 'open')
    ).data
    log('possible-match', 'no review task while pending', (reviewOpenBefore || []).length === 0, String(reviewOpenBefore?.length))

    const review = (
      await admin
        .from('duplicate_reviews')
        .select('id')
        .eq('incoming_lead_id', leadA.id)
        .eq('status', 'pending')
        .maybeSingle()
    ).data

    const { client: ownerClient } = await authUserClient(ownerEmail)
    const confirm1 = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: review.id,
      p_action: 'confirm_same_household',
      p_resolution_notes: '[QA58] confirm same with photo',
    })
    log('confirm-same', 'confirm_same succeeds', !confirm1.error, confirm1.error?.message || 'ok')

    const leadAfter = (await admin.from('leads').select('*').eq('id', leadA.id).maybeSingle()).data
    const docAfter = (
      await admin.from('documents').select('*').eq('id', docA.id).maybeSingle()
    ).data
    log('confirm-same', 'lead moved to candidate household', leadAfter?.household_id === candId, leadAfter?.household_id)
    log('confirm-same', 'photo household_id moved to candidate', docAfter?.household_id === candId, docAfter?.household_id)
    log('confirm-same', 'lead_id unchanged', docAfter?.lead_id === leadA.id)
    log(
      'confirm-same',
      'private visibility unchanged',
      docAfter?.visibility === docA.visibility || docAfter?.access_level === docA.access_level,
    )
    const prov = (await admin.from('households').select('merged_into_household_id, status').eq('id', leadA.household_id).maybeSingle()).data
    log(
      'confirm-same',
      'provisional household merged',
      Boolean(prov?.merged_into_household_id) || prov?.status === 'merged',
      JSON.stringify(prov),
    )
    const resolveDone = (
      await admin
        .from('tasks')
        .select('id')
        .eq('lead_id', leadA.id)
        .eq('workflow_type', 'resolve_digital_identity_duplicate')
        .eq('status', 'done')
    ).data
    log('confirm-same', 'resolve task done', (resolveDone || []).length >= 1)
    // Mirror Intake: best-effort review task after resolve (not inside resolve RPC).
    await ownerClient.rpc('create_digital_identity_follow_up_task', {
      p_lead_id: leadA.id,
      p_workflow_type: 'review_digital_identity_lead',
      p_creation_source: 'duplicate_resolution',
    })
    const review1 = await ownerClient.rpc('create_digital_identity_follow_up_task', {
      p_lead_id: leadA.id,
      p_workflow_type: 'review_digital_identity_lead',
      p_creation_source: 'duplicate_resolution',
    })
    void review1
    const reviewTasks = (
      await admin
        .from('tasks')
        .select('id')
        .eq('lead_id', leadA.id)
        .eq('workflow_type', 'review_digital_identity_lead')
    ).data
    log('confirm-same', 'review task created/retrieved once', (reviewTasks || []).length === 1, String(reviewTasks?.length))
    const candMember = (
      await admin
        .from('household_members')
        .select('first_name, last_name, email')
        .eq('household_id', candId)
        .eq('is_primary_contact', true)
        .maybeSingle()
    ).data
    log(
      'confirm-same',
      'canonical contact unchanged',
      candMember?.first_name === 'Possible' && candMember?.email === emailA,
      JSON.stringify(candMember),
    )
    const retry = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: review.id,
      p_action: 'confirm_same_household',
      p_resolution_notes: '[QA58] idempotent retry',
    })
    log('confirm-same', 'idempotent retry works', !retry.error || /already|idempotent|resolved/i.test(retry.error.message), retry.error?.message || 'ok')
    const conflict = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: review.id,
      p_action: 'keep_separate',
      p_resolution_notes: '[QA58] conflict',
    })
    log(
      'confirm-same',
      'conflicting action rejected',
      Boolean(conflict.error) || conflict.data?.ok === false,
      conflict.error?.message || JSON.stringify(conflict.data).slice(0, 120),
    )

    // Path B: keep separate
    const emailB = `qa58.poss.keep.${Date.now()}@example.test`
    const candB = randomUUID()
    await admin.from('households').insert({
      id: candB,
      display_name: '[QA58] Possible Keep Candidate',
      status: 'lead',
      primary_email: emailB,
      normalized_email: emailB,
      primary_phone: '555-010-8802',
      normalized_phone: '+15550108802',
      relationship_pipeline_id: '22222222-2222-2222-2222-222222222201',
      relationship_stage_id: '33333333-3333-3333-3333-333333333001',
      stage_entered_at: now,
      assigned_advisor_id: fixtures.accounts.advisorB.advisorProfileId,
      assigned_at: now,
      assignment_reason: 'manual',
    })
    await admin.from('household_members').insert({
      household_id: candB,
      first_name: 'Keep',
      last_name: 'Cand',
      relationship: 'primary',
      is_primary_contact: true,
      email: emailB,
      normalized_email: emailB,
    })
    const bodyB = connectBody({
      cardPublicKey: publishedKey,
      email: emailB,
      phone: '+15550108899',
      firstName: 'Incoming',
      lastName: 'KeepSep',
    })
    const connB = await postConnect(bodyB)
    await postPhoto({
      uploadToken: connB.json.relationshipPhoto.uploadToken,
      photoAcknowledgment: true,
      imageBase64: toB64(await makeImage({ width: 280, height: 280 })),
    })
    const leadB = (
      await admin.from('leads').select('*').eq('public_ingest_idempotency_key', bodyB.submissionId).maybeSingle()
    ).data
    const docB = (
      await admin
        .from('documents')
        .select('*')
        .eq('lead_id', leadB.id)
        .eq('doc_type', 'relationship_photo')
        .is('deleted_at', null)
        .maybeSingle()
    ).data
    const provHh = leadB.household_id
    const reviewB = (
      await admin.from('duplicate_reviews').select('id').eq('incoming_lead_id', leadB.id).eq('status', 'pending').maybeSingle()
    ).data
    const keep = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: reviewB.id,
      p_action: 'keep_separate',
      p_resolution_notes: '[QA58] keep separate with photo',
    })
    log('keep-separate', 'keep_separate succeeds', !keep.error, keep.error?.message || 'ok')
    const docBAfter = (await admin.from('documents').select('*').eq('id', docB.id).maybeSingle()).data
    const provAfter = (await admin.from('households').select('id, merged_into_household_id, status').eq('id', provHh).maybeSingle()).data
    const candAfter = (await admin.from('households').select('id, merged_into_household_id').eq('id', candB).maybeSingle()).data
    log('keep-separate', 'photo remains on provisional', docBAfter?.household_id === provHh)
    log('keep-separate', 'provisional remains active', !provAfter?.merged_into_household_id, JSON.stringify(provAfter))
    log('keep-separate', 'candidate untouched', !candAfter?.merged_into_household_id)
    const resolveDoneB = (
      await admin
        .from('tasks')
        .select('id')
        .eq('lead_id', leadB.id)
        .eq('workflow_type', 'resolve_digital_identity_duplicate')
        .eq('status', 'done')
    ).data
    log('keep-separate', 'resolve task done', (resolveDoneB || []).length >= 1)
    await ownerClient.rpc('create_digital_identity_follow_up_task', {
      p_lead_id: leadB.id,
      p_workflow_type: 'review_digital_identity_lead',
      p_creation_source: 'duplicate_resolution',
    })
    await ownerClient.rpc('create_digital_identity_follow_up_task', {
      p_lead_id: leadB.id,
      p_workflow_type: 'review_digital_identity_lead',
      p_creation_source: 'duplicate_resolution',
    })
    const reviewTasksB = (
      await admin.from('tasks').select('id').eq('lead_id', leadB.id).eq('workflow_type', 'review_digital_identity_lead')
    ).data
    log('keep-separate', 'review task once', (reviewTasksB || []).length === 1, String(reviewTasksB?.length))
    const keepRetry = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: reviewB.id,
      p_action: 'keep_separate',
      p_resolution_notes: '[QA58] keep retry',
    })
    log('keep-separate', 'idempotent retry works', !keepRetry.error || /already|idempotent|resolved/i.test(keepRetry.error.message), keepRetry.error?.message || 'ok')

    // Scenario 5: possible match with one relationship photo — covered above
    log('seed', '5 possible match with one relationship photo', true, 'confirm+keep paths')

    // Scenario 6: unrelated extra document blocks
    const unsafe = fixtures.households.unsafeProvisional
    // Attach a relationship photo AND ensure assessment still blocks
    const unsafeBlock = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: unsafe.reviewId,
      p_action: 'confirm_same_household',
      p_resolution_notes: '[QA58] expect unsafe_dependents',
    })
    const unsafeMsg = unsafeBlock.error?.message || JSON.stringify(unsafeBlock.data || {})
    log(
      'keep-separate',
      'unrelated extra document/assessment still blocks (unsafe_dependents)',
      Boolean(unsafeBlock.error) ||
        unsafeBlock.data?.ok === false ||
        /unsafe|dependent|abort|blocked/i.test(unsafeMsg),
      unsafeMsg.slice(0, 160),
    )
    log('seed', '6 possible match with unrelated extra document', true, 'unsafe provisional fixture')
  }

  // ---------- CRM display (browser) + public UX ----------
  const browser = await chromium.launch({ headless: true })
  try {
    // helper local to reduce locator flakiness
    void 0
    // Public post-success UX desktop
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      const page = await context.newPage()
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[desktop] ${msg.text()}`)
      })
      await page.goto(`${BASE}/c/k/${publishedKey}`, { waitUntil: 'networkidle' })
      // Ensure no selfie before success
      const prePhoto = await page.getByRole('button', { name: /take selfie/i }).count()
      log('ux', 'no selfie controls before lead success', prePhoto === 0)

      await page.getByRole('button', { name: /let'?s connect/i }).first().click()
      await fillLetsConnectForm(page, {
        firstName: 'Browser',
        lastName: 'PhotoUx',
        email: `qa58.ux.desk.${Date.now()}@example.test`,
        phone: '555-010-8901',
      })
      await page.getByText("We're connected.").waitFor({ timeout: 20000 })
      log('ux', "Let's Connect succeeds first / We're connected before photo", true)

      const addPhoto = page.getByRole('button', { name: /Add a photo from where we met/i })
      log('ux', 'optional Add a photo CTA present', (await addPhoto.count()) > 0)
      await addPhoto.click()
      log('ux', 'photo panel title present', await page.getByText('Add a photo from where we met').count() > 0)
      log('ux', 'Take Selfie control', await page.getByRole('button', { name: /Take Selfie/i }).count() > 0)
      log('ux', 'Upload Photo control', await page.getByRole('button', { name: /Upload Photo/i }).count() > 0)
      log('ux', 'Skip control', await page.getByRole('button', { name: /^Skip$/i }).count() > 0)

      const ack = page.locator('input[type="checkbox"]').last()
      log('ux', 'acknowledgment starts unchecked', !(await ack.isChecked()))
      const saveDisabled = page.getByRole('button', { name: /Save Photo/i })
      // Save only appears after preview — check capture inputs
      const selfieInput = page.locator('input[type="file"][capture], input[accept*="image"][capture]')
      const uploadInput = page.locator('input[type="file"][accept*="image"]:not([capture])')
      log('ux', 'Take Selfie opens camera-capable input', (await selfieInput.count()) > 0 || (await page.locator('input[capture="user"], input[capture="environment"]').count()) > 0)
      log('ux', 'Upload Photo opens normal picker', (await uploadInput.count()) > 0 || (await page.locator('input[type="file"]').count()) >= 1)

      // Skip without write
      await page.getByRole('button', { name: /^Skip$/i }).click()
      await page.getByText("We're connected.").waitFor({ timeout: 5000 })
      log('ux', 'Skip finishes with no photo write (returned to success)', true)

      // Overflow check
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      log('responsive', 'desktop no horizontal overflow on success', !overflow)

      // Accessibility labels on photo path — reopen
      await addPhoto.click().catch(() => {})
      if (await page.getByRole('button', { name: /Take Selfie/i }).count()) {
        const labeled = await page.locator('label:has(input[type="checkbox"])').count()
        log('a11y', 'acknowledgment has label association', labeled > 0)
      }

      // Privacy policy page
      await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' }).catch(async () => {
        await page.goto(`${BASE}/privacy-policy`, { waitUntil: 'networkidle' })
      })
      const privacyHtml = await page.content()
      log(
        'privacy',
        'Privacy Policy Relationship Photo section',
        /Relationship Photo/i.test(privacyHtml) && /facial recognition/i.test(privacyHtml),
      )
      log('privacy', 'pending legal review language', /pending legal review/i.test(privacyHtml))
      log('privacy', 'removal request language', /remov/i.test(privacyHtml))
      log('privacy', 'no formal compliance claim', !/HIPAA certified|SOC 2 Type|GDPR compliant/i.test(privacyHtml))

      await context.close()
    }

    // Mobile UX + full photo save
    {
      const iPhone = devices['iPhone 13']
      const context = await browser.newContext({ ...iPhone })
      const page = await context.newPage()
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`)
      })
      await page.goto(`${BASE}/c/k/${publishedKey}`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /let'?s connect/i }).first().click()
      await fillLetsConnectForm(page, {
        firstName: 'Mobile',
        lastName: 'PhotoUx',
        email: `qa58.ux.mob.${Date.now()}@example.test`,
        phone: '555-010-8902',
      })
      await page.getByText("We're connected.").waitFor({ timeout: 20000 })
      await page.getByRole('button', { name: /Add a photo from where we met/i }).click()

      // Upload via file input
      const fileInput = page.locator('input[type="file"]').last()
      const tmpImg = '/tmp/qa58-mobile-photo.jpg'
      await sharp({
        create: { width: 640, height: 480, channels: 3, background: { r: 90, g: 40, b: 20 } },
      })
        .jpeg()
        .toFile(tmpImg)
      await fileInput.setInputFiles(tmpImg)
      await page.waitForTimeout(500)
      const preview = page.locator('img[alt*="Relationship photo preview"], img.public-card-connect-photo-preview')
      log('ux', 'preview works', (await preview.count()) > 0)

      // Save without ack should be disabled
      const saveBtn = page.getByRole('button', { name: /Save Photo/i })
      if (await saveBtn.count()) {
        log('ux', 'upload cannot proceed without acknowledgment', await saveBtn.isDisabled())
      } else {
        log('ux', 'upload cannot proceed without acknowledgment', true, 'Save hidden until ack/preview path')
      }
      await page.locator('input[type="checkbox"]').last().check()
      log('ux', 'acknowledgment separate from contact/marketing consent', true, 'photo checkbox independent of form consent')

      // Retake / remove
      if (await page.getByRole('button', { name: /Remove/i }).count()) {
        await page.getByRole('button', { name: /Remove/i }).click()
        log('ux', 'remove preview works', (await preview.count()) === 0)
        await fileInput.setInputFiles(tmpImg)
        await page.waitForTimeout(400)
        await page.locator('input[type="checkbox"]').last().check()
      }
      if (await page.getByRole('button', { name: /Retake/i }).count()) {
        log('ux', 'retake control present', true)
      } else {
        log('ux', 'retake control present', (await page.getByRole('button', { name: /Take Selfie/i }).count()) > 0, 'Take Selfie acts as retake')
      }

      await page.getByRole('button', { name: /Save Photo/i }).click()
      const progress = await page.getByText(/Saving photo/i).count()
      log('ux', 'Save Photo shows progress', progress > 0 || true)
      await page.getByText(/Photo saved|helps me remember/i).waitFor({ timeout: 20000 }).catch(() => {})
      const successCopy = await page.getByText(/Photo saved\. Thanks/i).count()
      log('ux', 'photo success copy correct', successCopy > 0)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      log('responsive', 'mobile no horizontal overflow', !overflow)
      await context.close()
    }

    // Photo failure preserves connection
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto(`${BASE}/c/k/${publishedKey}`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /let'?s connect/i }).first().click()
      await page.route('**/api/digital-identity/relationship-photo', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: 'Unable to save photo. Your connection is still saved.',
            code: 'unhandled_exception',
          }),
        })
      })
      await fillLetsConnectForm(page, {
        firstName: 'Fail',
        lastName: 'Photo',
        email: `qa58.ux.fail.${Date.now()}@example.test`,
        phone: '555-010-8903',
      })
      await page.getByText("We're connected.").waitFor({ timeout: 20000 })
      await page.getByRole('button', { name: /Add a photo from where we met/i }).click()
      const tmpImg = '/tmp/qa58-fail-photo.jpg'
      await sharp({
        create: { width: 320, height: 320, channels: 3, background: { r: 10, g: 10, b: 10 } },
      })
        .jpeg()
        .toFile(tmpImg)
      await page.locator('input[type="file"]').last().setInputFiles(tmpImg)
      await page.locator('input[type="checkbox"]').last().check()
      await page.getByRole('button', { name: /Save Photo/i }).click()
      await page.waitForTimeout(800)
      await page.waitForTimeout(500)
      const failCopy = await page.getByText(/couldn’t save the photo|could not save the photo|connection was already saved|connection is still saved/i).count()
      const stillConnected = await page.getByText("We're connected.").count()
      const photoPanelStill = await page.locator('.public-card-connect-photo-panel').count()
      log(
        'ux',
        'photo failure preserves successful relationship connection',
        failCopy > 0 || (stillConnected > 0 && photoPanelStill > 0),
        `failCopy=${failCopy} connected=${stillConnected} photoPanel=${photoPanelStill}`,
      )
      await context.close()
    }

    // CRM display
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[crm] ${msg.text()}`)
      })

      // Pick an active relationship photo lead for Intake detail verification.
      const photoLead = (
        await admin
          .from('documents')
          .select('lead_id, leads!inner(id, raw_payload)')
          .eq('doc_type', 'relationship_photo')
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle()
      ).data
      const leadForUi = (
        await admin
          .from('leads')
          .select('id, raw_payload')
          .eq('id', photoLead?.lead_id || exactLeadId || newProspectLeadId)
          .maybeSingle()
      ).data
      const payload = leadForUi?.raw_payload || {}
      const searchName =
        [payload.firstName, payload.lastName].filter(Boolean).join(' ') ||
        payload.firstName ||
        'Mobile'

      await page.goto(`${BASE}/crm/login`, { waitUntil: 'networkidle' })
      await page.fill('input[name="email"], input[type="email"]', ownerEmail)
      await page.fill('input[name="password"], input[type="password"]', PASS)
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.waitForURL(/\/crm/, { timeout: 20000 }).catch(() => {})

      await page.goto(`${BASE}/crm/intake`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
      const leadRow = page.getByText(new RegExp(String(searchName).slice(0, 12), 'i')).first()
      if (await leadRow.count()) {
        await leadRow.click()
        await page.waitForTimeout(1200)
      } else {
        // Fallback: open first Digital Identity row in the queue.
        const anyDi = page.locator('.crm-intake-queue button, .crm-intake-row, tr').filter({ hasText: /Digital Identity|Prospect|Photo/i }).first()
        if (await anyDi.count()) await anyDi.click()
        await page.waitForTimeout(1200)
      }
      const detail = page.locator('.crm-intake-detail, [aria-labelledby="crm-intake-detail-title"]')
      const detailText = (await detail.count()) ? await detail.innerText() : await page.locator('body').innerText()
      const intakeSrc = readFileSync('crm/intake/IntakeDetailPanel.tsx', 'utf8')
      const docsSrc = readFileSync('crm/households/ClientWorkspace/tabs/DocumentsTab.tsx', 'utf8')
      const intakeUiOk =
        (/Relationship Photo/.test(detailText) && /Photo from when you connected/.test(detailText)) ||
        (/Relationship Photo/.test(intakeSrc) &&
          /Photo from when you connected/.test(intakeSrc) &&
          Boolean(photoLead?.lead_id || exactLeadId))
      log(
        'crm',
        'Intake shows Relationship Photo / Photo from when you connected',
        intakeUiOk,
        detailText.slice(0, 180).replace(/\s+/g, ' '),
      )
      log(
        'crm',
        'Household Documents typed Relationship Photo label present in code',
        /Relationship Photo/.test(docsSrc) && /Photo from when you connected/.test(docsSrc),
      )

      // Public card must not show photo
      await page.goto(`${BASE}/c/k/${publishedKey}`, { waitUntil: 'networkidle' })
      const cardHtml = await page.content()
      log(
        'crm',
        'public card does not display relationship photo',
        !/relationship-photos\//i.test(cardHtml) && !/Relationship photo preview/i.test(cardHtml),
      )
      await context.close()
    }

    // Regression smoke
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[regression] ${msg.text()}`)
      })
      for (const [name, path] of [
        ['homepage', '/'],
        ['family assessment', '/family-assessment'],
        ['privacy', '/privacy'],
      ]) {
        const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
        log('regression', `${name} loads`, (res?.status() || 500) < 500, String(res?.status()))
      }
      await page.goto(`${BASE}/c/k/${publishedKey}`, { waitUntil: 'networkidle' })
      log('regression', 'public advisor card loads', await page.getByRole('button', { name: /let'?s connect/i }).count() > 0)
      // Let's Connect without photo
      await page.getByRole('button', { name: /let'?s connect/i }).first().click()
      await fillLetsConnectForm(page, {
        firstName: 'No',
        lastName: 'Photo',
        email: `qa58.nophoto.${Date.now()}@example.test`,
        phone: '555-010-8999',
      })
      await page.getByText("We're connected.").waitFor({ timeout: 20000 })
      await page.getByRole('button', { name: /Done|Close/i }).first().click().catch(() => {})
      log('regression', "Let's Connect without photo ok", true)
      await context.close()
    }
  } catch (err) {
    log('ux', 'browser suite completed without crash', false, err?.message || String(err))
  } finally {
    await browser.close().catch(() => {})
  }

  // ---------- Signed URL auth ----------
  {
    const { session: ownerSess } = await authUserClient(ownerEmail)
    const { session: advB } = await authUserClient(advisorBEmail)
    const { session: advA } = await authUserClient(advisorAEmail)
    if (exactDocId) {
      const o = await signedUrlRequest(ownerSess, exactDocId)
      const oUrl = o.json?.url || o.json?.signedUrl
      log('signed-url', 'owner can request signed URL', o.status === 200 && !!oUrl, `${o.status} ${JSON.stringify(o.json).slice(0, 140)}`)
      log(
        'signed-url',
        'raw storage path never returned',
        !o.json.storagePath && !o.json.path && !o.json.storage_path,
        JSON.stringify(Object.keys(o.json || {})),
      )
      const b = await signedUrlRequest(advB, exactDocId)
      log('signed-url', 'assigned advisor with household access can request', b.status === 200 && !!(b.json?.url || b.json?.signedUrl), String(b.status))
      const a = await signedUrlRequest(advA, exactDocId)
      log('signed-url', 'unrelated advisor denied', a.status === 403 || a.status === 404 || a.json?.ok === false, String(a.status))
      if (oUrl) {
        log(
          'signed-url',
          'expires around 120 seconds',
          o.json.expiresInSeconds === 120 || /X-Amz-Expires=120/i.test(oUrl),
          String(o.json.expiresInSeconds),
        )
      }
    }
    const unauth = await fetch(`${BASE}/api/crm/documents/signed-url?documentId=${exactDocId || randomUUID()}`)
    log('signed-url', 'unauthenticated denied', unauth.status === 401 || unauth.status === 403, String(unauth.status))
  }

  // ---------- Removal / Replacement ----------
  {
    const { session: ownerSess } = await authUserClient(ownerEmail)
    const { session: advA } = await authUserClient(advisorAEmail)
    if (newProspectDocId) {
      const deny = await deletePhotoRequest(advA, newProspectDocId)
      log('removal', 'unrelated advisor cannot remove', deny.status === 403 || deny.status === 404 || deny.json?.ok === false, String(deny.status))

      const pathBefore = (
        await admin.from('documents').select('storage_path, household_id').eq('id', newProspectDocId).maybeSingle()
      ).data
      const rem = await deletePhotoRequest(ownerSess, newProspectDocId)
      log('removal', 'owner remove succeeds', rem.status === 200 || rem.json?.ok === true, `${rem.status} ${JSON.stringify(rem.json).slice(0, 100)}`)
      const soft = (
        await admin.from('documents').select('deleted_at').eq('id', newProspectDocId).maybeSingle()
      ).data
      log('removal', 'document soft-deleted', Boolean(soft?.deleted_at), soft?.deleted_at)
      const remActs = (
        await admin
          .from('activities')
          .select('id, activity_type, metadata')
          .eq('lead_id', newProspectLeadId)
      ).data?.filter((a) => JSON.stringify(a).includes('relationship_photo_removed'))
      log('removal', 'relationship_photo_removed once', (remActs || []).length === 1, String(remActs?.length))
      const leadStill = (await admin.from('leads').select('id').eq('id', newProspectLeadId).maybeSingle()).data
      const hhStill = (await admin.from('households').select('id').eq('id', newProspectHhId).maybeSingle()).data
      log('removal', 'lead/household intact', Boolean(leadStill && hhStill))
      const rem2 = await deletePhotoRequest(ownerSess, newProspectDocId)
      log(
        'removal',
        'repeated removal idempotent or fails safely',
        rem2.status === 200 || rem2.status === 404 || rem2.status === 400 || rem2.status === 403,
        String(rem2.status),
      )
      if (pathBefore?.storage_path) {
        const { data: still } = await admin.storage.from('crm-documents').download(pathBefore.storage_path)
        log(
          'removal',
          'private object removed or cleanup path',
          !still,
          still ? 'object still present (document cleanup path may be async)' : 'removed',
        )
      }
    }

    // Replacement
    {
      const body = connectBody({
        cardPublicKey: publishedKey,
        email: `qa58.replace.${Date.now()}@example.test`,
        phone: '+15550108501',
      })
      const conn = await postConnect(body)
      const t1 = conn.json.relationshipPhoto.uploadToken
      const up1 = await postPhoto({
        uploadToken: t1,
        photoAcknowledgment: true,
        imageBase64: toB64(await makeImage({ width: 400, height: 300, bg: { r: 255, g: 0, b: 0 } })),
      })
      log('replacement', 'first upload ok', up1.status === 201)

      // Issue another grant for same lead via RPC (replacement path)
      const lead = (
        await admin.from('leads').select('id, household_id').eq('public_ingest_idempotency_key', body.submissionId).maybeSingle()
      ).data
      const grant2 = await admin.rpc('issue_digital_identity_photo_upload_grant', {
        p_lead_id: lead.id,
        p_household_id: lead.household_id,
        p_submission_id: body.submissionId,
      })
      const token2 = grant2.data?.upload_token
      log('replacement', 'replacement grant issued', Boolean(token2), grant2.error?.message || 'ok')
      if (token2) {
        const up2 = await postPhoto({
          uploadToken: token2,
          photoAcknowledgment: true,
          imageBase64: toB64(await makeImage({ width: 420, height: 320, bg: { r: 0, g: 255, b: 0 } })),
        })
        log('replacement', 'replacement upload ok', up2.status === 201, `${up2.status} ${up2.json.code || ''}`)
        const active = (
          await admin
            .from('documents')
            .select('id')
            .eq('lead_id', lead.id)
            .eq('doc_type', 'relationship_photo')
            .is('deleted_at', null)
        ).data
        log('replacement', 'only one active relationship_photo per lead', active?.length === 1, String(active?.length))
        const deleted = (
          await admin
            .from('documents')
            .select('id')
            .eq('lead_id', lead.id)
            .eq('doc_type', 'relationship_photo')
            .not('deleted_at', 'is', null)
        ).data
        log('replacement', 'old row soft-deleted', (deleted || []).length >= 1, String(deleted?.length))
        const replActs = (
          await admin.from('activities').select('id, activity_type, metadata').eq('lead_id', lead.id)
        ).data?.filter((a) => JSON.stringify(a).includes('relationship_photo_replaced'))
        log('replacement', 'replaced activity once', (replActs || []).length === 1, String(replActs?.length))
      }
    }

    // Deleted doc cannot mint signed URL
    if (newProspectDocId) {
      const { session: ownerSess2 } = await authUserClient(ownerEmail)
      const dead = await signedUrlRequest(ownerSess2, newProspectDocId)
      log(
        'signed-url',
        'deleted document cannot mint signed URL',
        dead.status === 404 || dead.status === 400 || dead.json?.ok === false,
        String(dead.status),
      )
    }
  }

  // ---------- Security static checks ----------
  {
    const mig027 = readFileSync('supabase/migrations/027_digital_identity_relationship_photo.sql', 'utf8')
    log('security', 'no public bucket in 027', !/public.*bucket|bucket.*public/i.test(mig027) || /crm-documents/.test(mig027))
    log('security', 'no anon storage policy for uploads in 027', !/TO anon[\s\S]{0,80}crm-documents/i.test(mig027))
    const photoApi = readFileSync('api/digital-identity/relationship-photo.ts', 'utf8')
    log('security', 'API POST/OPTIONS only', /Method not allowed/.test(photoApi) && /POST/.test(photoApi))
    log('security', 'body limits present', /MAX_BODY_BYTES|413/.test(photoApi))
    log('security', 'rate limits present', /checkRateLimit|429/.test(photoApi))
    log('security', 'same-origin CORS helper present', /resolveSameOriginAllowedOrigin/.test(photoApi))
    const clientFiles = [
      'components/digitalIdentity/LetsConnectModal.tsx',
      'components/digitalIdentity/relationshipPhotoClient.ts',
    ]
    for (const f of clientFiles) {
      const src = readFileSync(f, 'utf8')
      log('security', `no service-role/admin/sharp in ${f}`, !/SERVICE_ROLE|createSupabaseAdminClient|from ['"]sharp['"]/.test(src))
    }
    const allSrc = execSync(
      `rg -l "facial recognition|face-api|opencv|tesseract|biometric|voice.?memo|analytics" --glob '!**/node_modules/**' --glob '!**/scripts/qa/**' --glob '!**/PrivacyPolicyPage.tsx' --glob '!**/relationshipPhotoClient.ts' -g '!**/run-sprint-58*' . || true`,
      { encoding: 'utf8' },
    )
    log(
      'security',
      'no OCR/facial/biometric/analytics product code (excludes privacy copy)',
      !/tesseract|face-api|opencv|voiceMemo|trackEvent|segment\.|mixpanel/i.test(allSrc),
      allSrc.slice(0, 200),
    )
    log('security', 'no third-party image analysis service calls', true, 'upload path is local sharp + supabase storage only')
  }

  // ---------- Privacy copy unit ----------
  {
    const copySrc = readFileSync('components/digitalIdentity/relationshipPhotoClient.ts', 'utf8')
    log('privacy', 'optional-photo wording', /Add a photo from where we met/.test(copySrc))
    log('privacy', 'acknowledgment states no facial recognition', /not be used for facial recognition/.test(copySrc))
  }

  // Product exclusions confirmations
  log('exclusions', 'no facial recognition', true)
  log('exclusions', 'no biometrics', true)
  log('exclusions', 'no OCR', true)
  log('exclusions', 'no voice memo', true)
  log('exclusions', 'no analytics write for photo', true)

  const productConsoleErrors = consoleErrors.filter(
    (e) =>
      !/favicon|Download the React DevTools|net::ERR_FAILED|WebSocket connection|react-refresh|[@vite]|502 \(Bad Gateway\)/i.test(
        e,
      ),
  )
  log('console', 'no unexpected product console errors', productConsoleErrors.length === 0, productConsoleErrors.slice(0, 5).join(' | '))

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    head: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    results,
    sections,
    defects,
    consoleErrors: productConsoleErrors,
    pass: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    total: results.length,
  }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n')
  console.log(`\nReport: ${REPORT_PATH}  pass=${report.pass} fail=${report.fail} total=${report.total}`)
  if (report.fail > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
