import ReportDashboard from '../reportDashboard/ReportDashboard'
import {
  BUSINESS_SAMPLE_GREETING,
  DEMO_BUSINESS_ANSWERS,
  getBusinessReportDashboardData,
} from '../reportCard/businessReportCardData'

export default function BusinessReportHeroPreview() {
  const data = getBusinessReportDashboardData(
    'Sample Business LLC',
    BUSINESS_SAMPLE_GREETING,
    DEMO_BUSINESS_ANSWERS,
  )

  return (
    <div className="business-report-preview" aria-label="Sample business report card preview">
      <div className="business-report-preview-frame">
        <div className="business-report-preview-stage">
          <ReportDashboard data={data} />
        </div>
      </div>
    </div>
  )
}
