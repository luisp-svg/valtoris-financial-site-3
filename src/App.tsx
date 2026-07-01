import { ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import HomePage from '../pages/HomePage'
import CheckupPage from '../pages/CheckupPage'
import FamilyProtectionCalculator from '../pages/FamilyProtectionCalculator'
import FamilyProtectionResults from '../pages/FamilyProtectionResults'
import BusinessReportCardPage from '../pages/BusinessReportCardPage'
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
      <Route path="/assessment" element={<FinancialProtectionAssessment />} />
      <Route path="/results" element={<FamilyReportCardResults />} />
      <Route path="/schedule" element={<ScheduleReportCardPage />} />
      <Route
        path="/"
        element={
          <SiteLayout>
            <HomePage />
          </SiteLayout>
        }
      />
      <Route
        path="/checkup"
        element={
          <SiteLayout>
            <CheckupPage />
          </SiteLayout>
        }
      />
      <Route path="/protectioncalc" element={<FamilyProtectionCalculator />} />
      <Route path="/protection-results" element={<FamilyProtectionResults />} />
      <Route
        path="/business"
        element={
          <SiteLayout>
            <BusinessReportCardPage />
          </SiteLayout>
        }
      />
    </Routes>
  )
}
