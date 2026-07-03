import { useEffect } from 'react'
import ReportCardDocument from '../reportCard/ReportCardDocument'

type SampleReportModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function SampleReportModal({ isOpen, onClose }: SampleReportModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="sample-report-modal" role="dialog" aria-modal="true" aria-label="Sample report">
      <button
        type="button"
        className="sample-report-modal-backdrop"
        aria-label="Close sample report"
        onClick={onClose}
      />

      <div className="sample-report-modal-panel">
        <header className="sample-report-modal-header">
          <div>
            <p className="sample-report-modal-kicker">Valtoris Financial</p>
            <h2 className="sample-report-modal-title">Sample Family Financial Report Card™</h2>
          </div>
          <button type="button" className="sample-report-modal-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="sample-report-modal-body">
          <ReportCardDocument />
        </div>
      </div>
    </div>
  )
}
