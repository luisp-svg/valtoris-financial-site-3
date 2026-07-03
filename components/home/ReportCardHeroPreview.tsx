import { useState } from 'react'
import { ReportCardSinglePage } from '../reportCard/ReportCardDocument'
import { REPORT_PAGES } from '../reportCard/reportCardData'

export default function ReportCardHeroPreview() {
  const [activePageIndex, setActivePageIndex] = useState(0)
  const activePage = REPORT_PAGES[activePageIndex]

  function goToPage(index: number) {
    setActivePageIndex(index)
  }

  function goToPreviousPage() {
    setActivePageIndex((current) => (current === 0 ? REPORT_PAGES.length - 1 : current - 1))
  }

  function goToNextPage() {
    setActivePageIndex((current) => (current === REPORT_PAGES.length - 1 ? 0 : current + 1))
  }

  return (
    <div className="home-report-preview">
      <div className="home-report-preview-frame">
        <div className="home-report-preview-stage" aria-live="polite">
          <ReportCardSinglePage
            pageId={activePage.id}
            showHeader={false}
            className="home-report-preview-document"
          />
        </div>

        <div className="home-report-preview-footer">
          <button
            type="button"
            className="home-report-preview-nav"
            onClick={goToPreviousPage}
            aria-label="Previous report page"
          >
            ‹
          </button>

          <div className="home-report-preview-meta">
            <p className="home-report-preview-page-name">{activePage.label}</p>
            <div className="home-report-preview-dots" role="tablist" aria-label="Report pages">
              {REPORT_PAGES.map((page, index) => (
                <button
                  key={page.id}
                  type="button"
                  role="tab"
                  className={`home-report-preview-dot${index === activePageIndex ? ' is-active' : ''}`}
                  aria-selected={index === activePageIndex}
                  aria-label={page.label}
                  onClick={() => goToPage(index)}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="home-report-preview-nav"
            onClick={goToNextPage}
            aria-label="Next report page"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
