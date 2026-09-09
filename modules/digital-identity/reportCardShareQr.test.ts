import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../constants/routes'
import {
  buildQrDestinationUrl,
  buildReportCardSharePath,
  buildReportCardShareQrDestinationUrl,
  isAllowedQrDestination,
  isKeyBasedQrDestination,
  qrGenerationSideEffects,
  REPORT_CARD_SHARE_TYPES,
} from './index'

const KEY = 'pk_live_abcdefghijklmnop'
const OTHER_KEY = 'pk_live_othercardkey01'
const ADVISOR_UUID = '11111111-2222-4333-8444-555555555555'
const ORIGIN = 'https://valtoris.example'

describe('Report Card QR destination allowlist', () => {
  it('keeps existing /c/k/{publicKey} QR destinations valid', () => {
    expect(isKeyBasedQrDestination(`/c/k/${KEY}`)).toBe(true)
    expect(isAllowedQrDestination(`/c/k/${KEY}`, KEY)).toBe(true)
    expect(isAllowedQrDestination(`${ORIGIN}/c/k/${KEY}`, KEY)).toBe(true)
    expect(isAllowedQrDestination(`/c/k/${KEY}?c=summit&src=qr`, KEY)).toBe(true)
    expect(isKeyBasedQrDestination(`/c/jane-advisor`)).toBe(false)
    expect(buildQrDestinationUrl(ORIGIN, KEY)).toBe(`${ORIGIN}/c/k/${KEY}`)
  })

  it('accepts each of the six approved Report Card share destinations', () => {
    for (const type of REPORT_CARD_SHARE_TYPES) {
      const path = buildReportCardSharePath(KEY, type)
      const absolute = buildReportCardShareQrDestinationUrl(ORIGIN, KEY, type)
      expect(path).toBeTruthy()
      expect(path).toContain(`card=${KEY}`)
      expect(isAllowedQrDestination(path!, KEY)).toBe(true)
      expect(absolute).toBe(`${ORIGIN}${path}`)
      expect(isAllowedQrDestination(absolute!, KEY, { origin: ORIGIN })).toBe(true)
    }
    expect(buildReportCardSharePath(KEY, 'family')).toBe(`${ROUTES.reportCard}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'business')).toBe(`${ROUTES.businessReportCard}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'protection')).toBe(`${ROUTES.protectionGap}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'student_loan')).toBe(
      `${ROUTES.studentLoanReportCard}?card=${KEY}`,
    )
    expect(buildReportCardSharePath(KEY, 'credit')).toBe(`${ROUTES.creditReportCard}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'home_buyer')).toBe(
      `${ROUTES.homeBuyerReportCard}?card=${KEY}`,
    )
  })

  it('rejects unsupported internal paths, mismatched keys, and UUIDs', () => {
    expect(isAllowedQrDestination(`${ROUTES.familyAssessment}?card=${KEY}`, KEY)).toBe(false)
    expect(isAllowedQrDestination(`${ROUTES.homeBuyerAssessment}?card=${KEY}`, KEY)).toBe(false)
    expect(isAllowedQrDestination(`${ROUTES.reportCardResults}?card=${KEY}`, KEY)).toBe(false)
    expect(isAllowedQrDestination('/r/pk_live_abcdefghijklmnop/family', KEY)).toBe(false)
    expect(isAllowedQrDestination(`${ROUTES.reportCard}`, KEY)).toBe(false)
    expect(isAllowedQrDestination(`${ROUTES.reportCard}?card=${OTHER_KEY}`, KEY)).toBe(false)
    expect(isAllowedQrDestination(`${ROUTES.reportCard}?card=${ADVISOR_UUID}`, ADVISOR_UUID)).toBe(
      false,
    )
    expect(buildReportCardShareQrDestinationUrl(ORIGIN, ADVISOR_UUID, 'family')).toBeNull()
    expect(buildReportCardShareQrDestinationUrl(ORIGIN, KEY, 'retirement')).toBeNull()
  })

  it('rejects arbitrary external URLs and unsafe query keys', () => {
    expect(
      isAllowedQrDestination(`https://evil.example${ROUTES.reportCard}?card=${KEY}`, KEY, {
        origin: ORIGIN,
      }),
    ).toBe(false)
    expect(
      isAllowedQrDestination(`https://evil.example${ROUTES.reportCard}?card=${KEY}`, KEY),
    ).toBe(false)
    expect(isAllowedQrDestination(`javascript:alert(1)`, KEY)).toBe(false)
    expect(
      isAllowedQrDestination(`${ROUTES.reportCard}?card=${KEY}&redirect=https://evil.example`, KEY),
    ).toBe(false)
    const withUtm = buildReportCardSharePath(KEY, 'credit', {
      campaignCode: 'summit',
      sourceChannel: 'qr',
      utmSource: 'flyer',
    })
    expect(withUtm).toBe(`${ROUTES.creditReportCard}?c=summit&src=qr&utm_source=flyer&card=${KEY}`)
    expect(isAllowedQrDestination(withUtm!, KEY)).toBe(true)
  })

  it('declares no lead, household, or activity writes from QR generation', () => {
    expect(qrGenerationSideEffects()).toMatchObject({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      createsActivity: false,
    })
  })
})
