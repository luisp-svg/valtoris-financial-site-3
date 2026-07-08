import { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { ROUTES } from '../constants/routes'
import HomePage from '../pages/HomePage'
import CheckupPage from '../pages/CheckupPage'
import FamilyProtectionCalculator from '../pages/FamilyProtectionCalculator'
import FamilyProtectionResults from '../pages/FamilyProtectionResults'
import BusinessReportCardPage from '../pages/BusinessReportCardPage'
import BusinessFinancialAssessment from '../pages/BusinessFinancialAssessment'
import BusinessReportCardResults from '../pages/BusinessReportCardResults'
import FinancialProtectionAssessment from '../pages/FinancialProtectionAssessment'
import FamilyReportCardResults from '../pages/FamilyReportCardResults'
import ScheduleReportCardPage from '../pages/ScheduleReportCardPage'

function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.reportCard} element={<FinancialProtectionAssessment />} />
      <Route path="/assessment" element={<Navigate to={ROUTES.reportCard} replace />} />
      <Route path="/report" element={<Navigate to={ROUTES.reportCard} replace />} />

      <Route path={ROUTES.reportCardResults} element={<FamilyReportCardResults />} />
      <Route path={ROUTES.businessReportCardResults} element={<BusinessReportCardResults />} />
      <Route path={ROUTES.businessAssessment} element={<BusinessFinancialAssessment />} />
      <Route path={ROUTES.schedule} element={<ScheduleReportCardPage />} />

      <Route
        path={ROUTES.home}
        element={
          <SiteLayout>
            <HomePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.checkup}
        element={
          <SiteLayout>
            <CheckupPage />
          </SiteLayout>
        }
      />

      <Route path={ROUTES.protectionGap} element={<FamilyProtectionCalculator />} />
      <Route path="/protectioncalc" element={<Navigate to={ROUTES.protectionGap} replace />} />
      <Route path="/calculator" element={<Navigate to={ROUTES.protectionGap} replace />} />

      <Route path={ROUTES.protectionResults} element={<FamilyProtectionResults />} />

      <Route
        path={ROUTES.businessReportCard}
        element={
          <SiteLayout>
            <BusinessReportCardPage />
          </SiteLayout>
        }
      />
      <Route path="/business" element={<Navigate to={ROUTES.businessReportCard} replace />} />
    </Routes>
  )
}
