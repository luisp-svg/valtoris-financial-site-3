import { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import ScrollToTop from '../components/ScrollToTop'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { ROUTES } from '../constants/routes'
import { CrmAuthProvider } from '../crm/auth/CrmAuthContext'
import { CrmLoginGate, CrmProtectedGate } from '../crm/components/CrmGate'
import HomePage from '../pages/HomePage'
import CheckupPage from '../pages/CheckupPage'
import FamilyProtectionCalculator from '../pages/FamilyProtectionCalculator'
import FamilyProtectionResults from '../pages/FamilyProtectionResults'
import BusinessReportCardPage from '../pages/BusinessReportCardPage'
import BusinessFinancialAssessment from '../pages/BusinessFinancialAssessment'
import BusinessReportCardResults from '../pages/BusinessReportCardResults'
import RetirementReportCardPage from '../pages/RetirementReportCardPage'
import RetirementAssessment from '../pages/RetirementAssessment'
import RetirementReportCardResults from '../pages/RetirementReportCardResults'
import FinancialProtectionAssessment from '../pages/FinancialProtectionAssessment'
import FamilyReportCardResults from '../pages/FamilyReportCardResults'
import FamilyReportCardPage from '../pages/FamilyReportCardPage'
import ProtectionAnalysisPage from '../pages/ProtectionAnalysisPage'
import SolutionsPage from '../pages/SolutionsPage'
import ScheduleReportCardPage from '../pages/ScheduleReportCardPage'
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage'
import NotFoundPage from '../pages/NotFoundPage'
import PublicAdvisorCardPage from '../pages/PublicAdvisorCardPage'
import CrmLoginPage from '../pages/crm/CrmLoginPage'
import CrmHomePage from '../pages/crm/CrmHomePage'
import CrmHouseholdsPage from '../pages/crm/CrmHouseholdsPage'
import CrmHouseholdWorkspacePage from '../pages/crm/CrmHouseholdWorkspacePage'
import CrmHouseholdOnboardingPage from '../pages/crm/CrmHouseholdOnboardingPage'
import CrmHouseholdAssessmentsPage from '../pages/crm/CrmHouseholdAssessmentsPage'
import CrmOpportunitiesPage from '../pages/crm/CrmOpportunitiesPage'
import CrmOpportunityWorkspacePage from '../pages/crm/CrmOpportunityWorkspacePage'
import CrmIntakePage from '../pages/crm/CrmIntakePage'
import CrmPlaceholderPage from '../pages/crm/CrmPlaceholderPage'
import CrmTasksPage from '../pages/crm/CrmTasksPage'
import CrmCampaignsPage from '../pages/crm/CrmCampaignsPage'

function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}

function CrmAuthLayout() {
  return (
    <CrmAuthProvider>
      <Outlet />
    </CrmAuthProvider>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path={ROUTES.familyAssessment} element={<FinancialProtectionAssessment />} />
      <Route path="/assessment" element={<Navigate to={ROUTES.familyAssessment} replace />} />
      <Route path="/report" element={<Navigate to={ROUTES.familyAssessment} replace />} />

      <Route path={ROUTES.reportCardResults} element={<FamilyReportCardResults />} />
      <Route path={ROUTES.businessReportCardResults} element={<BusinessReportCardResults />} />
      <Route path={ROUTES.businessAssessment} element={<BusinessFinancialAssessment />} />
      <Route path={ROUTES.retirementReportCardResults} element={<RetirementReportCardResults />} />
      <Route path={ROUTES.retirementAssessment} element={<RetirementAssessment />} />
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
        path={ROUTES.reportCard}
        element={
          <SiteLayout>
            <FamilyReportCardPage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.businessReportCard}
        element={
          <SiteLayout>
            <BusinessReportCardPage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.retirementReportCard}
        element={
          <SiteLayout>
            <RetirementReportCardPage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.protectionAnalysis}
        element={
          <SiteLayout>
            <ProtectionAnalysisPage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.solutions}
        element={
          <SiteLayout>
            <SolutionsPage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.privacy}
        element={
          <SiteLayout>
            <PrivacyPolicyPage />
          </SiteLayout>
        }
      />
      <Route path="/business" element={<Navigate to={ROUTES.businessReportCard} replace />} />

      {/* Public Digital Advisor Card — bare shell (no marketing chrome). Key route before slug. */}
      <Route path={ROUTES.publicCardByKey} element={<PublicAdvisorCardPage />} />
      <Route path={ROUTES.publicCardBySlug} element={<PublicAdvisorCardPage />} />

      <Route path="/crm" element={<CrmAuthLayout />}>
        <Route element={<CrmLoginGate />}>
          <Route path="login" element={<CrmLoginPage />} />
        </Route>
        <Route element={<CrmProtectedGate />}>
          <Route index element={<CrmHomePage />} />
          <Route path="intake" element={<CrmIntakePage />} />
          <Route path="campaigns" element={<CrmCampaignsPage />} />
          <Route path="leads" element={<Navigate to={ROUTES.crmIntake} replace />} />
          <Route path="households" element={<CrmHouseholdsPage />} />
          <Route
            path="households/:householdId/onboarding"
            element={<CrmHouseholdOnboardingPage />}
          />
          <Route
            path="households/:householdId/assessments/:assessmentId"
            element={<CrmHouseholdAssessmentsPage />}
          />
          <Route
            path="households/:householdId/assessments"
            element={<CrmHouseholdAssessmentsPage />}
          />
          <Route path="households/:householdId" element={<CrmHouseholdWorkspacePage />} />
          <Route path="pipeline" element={<CrmOpportunitiesPage />} />
          <Route path="opportunities/:opportunityId" element={<CrmOpportunityWorkspacePage />} />
          <Route path="tasks" element={<CrmTasksPage />} />
          <Route path="appointments" element={<CrmPlaceholderPage />} />
          <Route path="policies" element={<CrmPlaceholderPage />} />
          <Route path="annual-reviews" element={<CrmPlaceholderPage />} />
          <Route path="documents" element={<CrmPlaceholderPage />} />
          <Route path="settings" element={<CrmPlaceholderPage />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.crm} replace />} />
      </Route>

      <Route
        path="*"
        element={
          <SiteLayout>
            <NotFoundPage />
          </SiteLayout>
        }
      />
    </Routes>
    </>
  )
}
