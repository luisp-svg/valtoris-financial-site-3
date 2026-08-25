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
import StudentLoanServicePage from '../pages/StudentLoanServicePage'
import CreditServicePage from '../pages/CreditServicePage'
import InsuranceServicePage from '../pages/InsuranceServicePage'
import HealthDisabilityServicePage from '../pages/HealthDisabilityServicePage'
import BusinessFormationServicePage from '../pages/BusinessFormationServicePage'
import EstateLegacyServicePage from '../pages/EstateLegacyServicePage'
import TaxStrategyServicePage from '../pages/TaxStrategyServicePage'
import StudentLoanReportCardPage from '../pages/StudentLoanReportCardPage'
import StudentLoanAssessment from '../pages/StudentLoanAssessment'
import StudentLoanReportCardResults from '../pages/StudentLoanReportCardResults'
import CreditReportCardPage from '../pages/CreditReportCardPage'
import CreditAssessment from '../pages/CreditAssessment'
import CreditReportCardResults from '../pages/CreditReportCardResults'
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
import CrmPasswordRecoveryPage from '../pages/crm/CrmPasswordRecoveryPage'
import CrmHomePage from '../pages/crm/CrmHomePage'
import CrmHouseholdsPage from '../pages/crm/CrmHouseholdsPage'
import CrmHouseholdWorkspacePage from '../pages/crm/CrmHouseholdWorkspacePage'
import CrmHouseholdOnboardingPage from '../pages/crm/CrmHouseholdOnboardingPage'
import CrmHouseholdAssessmentsPage from '../pages/crm/CrmHouseholdAssessmentsPage'
import CrmOpportunitiesPage from '../pages/crm/CrmOpportunitiesPage'
import CrmOpportunityWorkspacePage from '../pages/crm/CrmOpportunityWorkspacePage'
import CrmIntakePage from '../pages/crm/CrmIntakePage'
import CrmContactsPage from '../pages/crm/CrmContactsPage'
import CrmContactNewPage from '../pages/crm/CrmContactNewPage'
import CrmContactDetailPage from '../pages/crm/CrmContactDetailPage'
import CrmPlaceholderPage from '../pages/crm/CrmPlaceholderPage'
import CrmTasksPage from '../pages/crm/CrmTasksPage'
import CrmCampaignsPage from '../pages/crm/CrmCampaignsPage'
import CrmProductionPage from '../pages/crm/CrmProductionPage'
import CrmCommissionsPage from '../pages/crm/CrmCommissionsPage'
import CrmCommissionsImportPage from '../pages/crm/CrmCommissionsImportPage'
import CrmCommissionsPendingImportPage from '../pages/crm/CrmCommissionsPendingImportPage'
import CrmProductionCatalogPage from '../pages/crm/CrmProductionCatalogPage'
import CrmProductionNewPage from '../pages/crm/CrmProductionNewPage'
import CrmProductionEditPage from '../pages/crm/CrmProductionEditPage'
import CrmProductionDetailPage from '../pages/crm/CrmProductionDetailPage'

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
      <Route path={ROUTES.studentLoanAssessment} element={<StudentLoanAssessment />} />
      <Route path={ROUTES.studentLoanReportCardResults} element={<StudentLoanReportCardResults />} />
      <Route path={ROUTES.creditAssessment} element={<CreditAssessment />} />
      <Route path={ROUTES.creditReportCardResults} element={<CreditReportCardResults />} />
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
        path={ROUTES.studentLoans}
        element={
          <SiteLayout>
            <StudentLoanServicePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.studentLoanReportCard}
        element={
          <SiteLayout>
            <StudentLoanReportCardPage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.credit}
        element={
          <SiteLayout>
            <CreditServicePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.insurance}
        element={
          <SiteLayout>
            <InsuranceServicePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.healthDisability}
        element={
          <SiteLayout>
            <HealthDisabilityServicePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.businessFormation}
        element={
          <SiteLayout>
            <BusinessFormationServicePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.estateLegacy}
        element={
          <SiteLayout>
            <EstateLegacyServicePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.taxStrategy}
        element={
          <SiteLayout>
            <TaxStrategyServicePage />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.creditReportCard}
        element={
          <SiteLayout>
            <CreditReportCardPage />
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
        {/* Public invite/recovery — outside login + protected gates so a recovery session is not bounced to /crm. */}
        <Route path="auth/recovery" element={<CrmPasswordRecoveryPage />} />
        <Route element={<CrmProtectedGate />}>
          <Route index element={<CrmHomePage />} />
          <Route path="intake" element={<CrmIntakePage />} />
          <Route path="contacts/new" element={<CrmContactNewPage />} />
          <Route path="contacts/:leadId" element={<CrmContactDetailPage />} />
          <Route path="contacts" element={<CrmContactsPage />} />
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
          <Route path="production/new" element={<CrmProductionNewPage />} />
          <Route path="production/catalog" element={<CrmProductionCatalogPage />} />
          <Route path="production/:applicationId/edit" element={<CrmProductionEditPage />} />
          <Route path="production/:applicationId" element={<CrmProductionDetailPage />} />
          <Route path="production" element={<CrmProductionPage />} />
          <Route path="commissions/import" element={<CrmCommissionsImportPage />} />
          <Route path="commissions/pending-import" element={<CrmCommissionsPendingImportPage />} />
          <Route path="commissions" element={<CrmCommissionsPage />} />
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
