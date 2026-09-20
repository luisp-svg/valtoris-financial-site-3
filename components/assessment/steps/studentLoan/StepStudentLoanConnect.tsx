import { useState } from 'react'
import QuestionCard from '../../QuestionCard'
import type { SpecializedCopyFn } from '../../specialized/renderer'
import {
  startStudentLoanConnection,
  StudentLoanConnectError,
  verifyStudentLoanConnection,
} from '../../studentLoan/spinwheelClient'
import type { StudentLoanVerificationAnswers } from '../../studentLoan/types'

type Props = {
  phone: string
  t: SpecializedCopyFn
  verification: StudentLoanVerificationAnswers
  onChange: (verification: StudentLoanVerificationAnswers) => void
}

type ConnectedIdentity = { fullName: string | null; maskedPhone: string | null }

export default function StepStudentLoanConnect({ phone, t, verification, onChange }: Props) {
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [identity, setIdentity] = useState<ConnectedIdentity | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    if (!dateOfBirth || !authorized || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await startStudentLoanConnection({ phone, dateOfBirth })
      setUserId(result.userId)
      setCode('')
    } catch (caught) {
      setError(caught instanceof StudentLoanConnectError ? caught.message : t('ui', 'spinwheelUnavailable'))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (!userId || !/^\d{6}$/.test(code) || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await verifyStudentLoanConnection({ userId, code })
      const { identity: returnedIdentity, ...summary } = result
      setIdentity(returnedIdentity)
      onChange(summary)
      setDateOfBirth('')
      setCode('')
      setUserId(null)
    } catch (caught) {
      setError(caught instanceof StudentLoanConnectError ? caught.message : t('ui', 'spinwheelUnavailable'))
    } finally {
      setBusy(false)
    }
  }

  function skip() {
    setDateOfBirth('')
    setCode('')
    setUserId(null)
    setError(null)
    onChange({
      source: 'self_reported',
      status: 'skipped',
      totalOutstandingBalance: null,
      loanCount: null,
      loanStatuses: [],
      servicers: [],
      loanTypes: [],
    })
  }

  const verified = verification.status === 'verified'
  const skipped = verification.status === 'skipped'

  return (
    <QuestionCard title={t('ui', 'spinwheelTitle')} description={t('ui', 'spinwheelBody')}>
      {verified ? (
        <div className="student-loan-connection-summary" data-testid="spinwheel-verified-summary">
          <p className="student-loan-source-badge">{t('ui', 'verifiedSource')}</p>
          {identity?.fullName || identity?.maskedPhone ? (
            <p>{[identity.fullName, identity.maskedPhone].filter(Boolean).join(' · ')}</p>
          ) : null}
          <dl>
            <div><dt>{t('ui', 'verifiedBalance')}</dt><dd>{verification.totalOutstandingBalance === null ? t('ui', 'needsVerification') : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(verification.totalOutstandingBalance)}</dd></div>
            <div><dt>{t('ui', 'verifiedLoanCount')}</dt><dd>{verification.loanCount ?? t('ui', 'needsVerification')}</dd></div>
            <div><dt>{t('ui', 'verifiedStatuses')}</dt><dd>{verification.loanStatuses.join(', ') || t('ui', 'needsVerification')}</dd></div>
            <div><dt>{t('ui', 'verifiedServicers')}</dt><dd>{verification.servicers.join(', ') || t('ui', 'needsVerification')}</dd></div>
          </dl>
          <p className="student-loan-sensitive-note">{t('ui', 'spinwheelMemoryOnly')}</p>
        </div>
      ) : skipped ? (
        <div className="student-loan-connection-summary">
          <p className="student-loan-source-badge student-loan-source-badge--reported">{t('ui', 'selfReportedSource')}</p>
          <p>{t('ui', 'spinwheelSkipped')}</p>
        </div>
      ) : userId ? (
        <div className="assessment-form">
          <label className="assessment-field">
            <span className="assessment-field-label">{t('ui', 'spinwheelCodeLabel')}</span>
            <input
              className="assessment-input"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-describedby="spinwheel-code-help"
            />
          </label>
          <p id="spinwheel-code-help" className="student-loan-sensitive-note">{t('ui', 'spinwheelCodeHelp')}</p>
          <button className="platform-btn platform-btn-primary" type="button" disabled={busy || !/^\d{6}$/.test(code)} onClick={() => void verify()}>
            {busy ? t('ui', 'spinwheelChecking') : t('ui', 'spinwheelVerify')}
          </button>
        </div>
      ) : (
        <div className="assessment-form">
          <label className="assessment-field">
            <span className="assessment-field-label">{t('ui', 'spinwheelDobLabel')}</span>
            <input
              className="assessment-input"
              type="date"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDateOfBirth(event.target.value)}
              autoComplete="bday"
            />
          </label>
          <p className="student-loan-sensitive-note">{t('ui', 'spinwheelDobNote')}</p>
          <label className="student-loan-spinwheel-consent">
            <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
            <span>
              {t('ui', 'spinwheelConsentBefore')}{' '}
              <a href="https://spinwheel.io/legal/end-user-agreement" target="_blank" rel="noreferrer">{t('ui', 'spinwheelAgreement')}</a>
              {t('ui', 'spinwheelConsentAfter')}
            </span>
          </label>
          <button className="platform-btn platform-btn-primary" type="button" disabled={busy || !dateOfBirth || !authorized} onClick={() => void connect()}>
            {busy ? t('ui', 'spinwheelSending') : t('ui', 'spinwheelConnect')}
          </button>
        </div>
      )}

      {error ? <p className="family-submit-error" role="alert">{error}</p> : null}
      {!verified && !skipped ? (
        <button className="student-loan-skip-connect" type="button" disabled={busy} onClick={skip}>
          {t('ui', 'spinwheelSkip')}
        </button>
      ) : null}
    </QuestionCard>
  )
}
