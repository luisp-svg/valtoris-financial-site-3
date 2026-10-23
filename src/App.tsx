import { guidedReportCardsEnabled } from '../modules/reportCard/guidedRelease'
import ShortLanding from '../components/reportCard/shortForm/ShortLanding'
import ShortAssessment from '../components/reportCard/shortForm/ShortAssessment'
import VersionedReportResults from '../components/reportCard/shortForm/ShortResults'
import { lazy, ReactNode, Suspense } from 'react'
const CrmStudentLoansPage = lazy(() => import('../pages/crm/CrmStudentLoansPage'))
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import ScrollToTop from '../components/ScrollToTop'
import PublicRouteIndexing from '../components/publicSite/PublicRouteIndexing'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { ROUTES } from '../constants/routes'
import { CrmAuthProvider } from '../crm/auth/CrmAuthContext'
import { CrmLoginGate, CrmProtectedGate } from '../crm/components/CrmGate'
import HomePage from '../pages/HomePage'
import ReportCardsPage from '../pages/ReportCardsPage'
import EducationPage from '../pages/EducationPage'
import GetQuotePage from '../pages/GetQuotePage'
import InsuranceQuotePage from '../pages/InsuranceQuotePage'
import CheckupPage from '../pages/CheckupPage'
import FamilyProtectionResults from '../pages/FamilyProtectionResults'
import BusinessReportCardResults from '../pages/BusinessReportCardResults'
import RetirementReportCardResults from '../pages/RetirementReportCardResults'
import StudentLoanServicePage from '../pages/StudentLoanServicePage'
import CreditServicePage from '../pages/CreditServicePage'
import InsuranceServicePage from '../pages/InsuranceServicePage'
import HealthDisabilityServicePage from '../pages/HealthDisabilityServicePage'
import BusinessFormationServicePage from '../pages/BusinessFormationServicePage'
import EstateLegacyServicePage from '../pages/EstateLegacyServicePage'
import TaxStrategyServicePage from '../pages/TaxStrategyServicePage'
import StudentLoanReportCardResults from '../pages/StudentLoanReportCardResults'
import CreditReportCardResults from '../pages/CreditReportCardResults'
import HomeBuyerReportCardResults from '../pages/HomeBuyerReportCardResults'
import FamilyReportCardResults from '../pages/FamilyReportCardResults'
import SolutionsPage from '../pages/SolutionsPage'
import ScheduleReportCardPage from '../pages/ScheduleReportCardPage'
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage'
import NotFoundPage from '../pages/NotFoundPage'
import PublicAdvisorCardPage from '../pages/PublicAdvisorCardPage'


// Load agent tools only when an agent opens their route.
const CrmAdditionalServiceIntakePage = lazy(() => import('../pages/crm/CrmAdditionalServiceIntakePage'))
const CrmClientIntakeNewPage = lazy(() => import('../pages/crm/CrmClientIntakeNewPage'))
const CrmArchivedRecordsPage = lazy(() => import('../pages/crm/CrmArchivedRecordsPage'))
const CrmLoginPage = lazy(() => import('../pages/crm/CrmLoginPage'))
const CrmPasswordRecoveryPage = lazy(() => import('../pages/crm/CrmPasswordRecoveryPage'))
const CrmHomePage = lazy(() => import('../pages/crm/CrmHomePage'))
const CrmHouseholdsPage = lazy(() => import('../pages/crm/CrmHouseholdsPage'))
const CrmHouseholdWorkspacePage = lazy(() => import('../pages/crm/CrmHouseholdWorkspacePage'))
const CrmHouseholdOnboardingPage = lazy(() => import('../pages/crm/CrmHouseholdOnboardingPage'))
const CrmHouseholdAssessmentsPage = lazy(() => import('../pages/crm/CrmHouseholdAssessmentsPage'))
const CrmOpportunitiesPage = lazy(() => import('../pages/crm/CrmOpportunitiesPage'))
const CrmRecruitingPage = lazy(() => import('../pages/crm/CrmRecruitingPage'))
const CrmRecruitDetailPage = lazy(() => import('../pages/crm/CrmRecruitDetailPage'))
const CrmOpportunityWorkspacePage = lazy(() => import('../pages/crm/CrmOpportunityWorkspacePage'))
const CrmIntakePage = lazy(() => import('../pages/crm/CrmIntakePage'))
const CrmContactsPage = lazy(() => import('../pages/crm/CrmContactsPage'))
const CrmContactNewPage = lazy(() => import('../pages/crm/CrmContactNewPage'))
const CrmContactDetailPage = lazy(() => import('../pages/crm/CrmContactDetailPage'))
const CrmStudentLoanIntakePage = lazy(() => import('../pages/crm/CrmStudentLoanIntakePage'))
const CrmLifeInsuranceIntakePage = lazy(() => import('../pages/crm/CrmLifeInsuranceIntakePage'))
const CrmPlaceholderPage = lazy(() => import('../pages/crm/CrmPlaceholderPage'))
const CrmTasksPage = lazy(() => import('../pages/crm/CrmTasksPage'))
const CrmOperationsPage = lazy(() => import('../pages/crm/CrmOperationsPage'))
const CrmCampaignsPage = lazy(() => import('../pages/crm/CrmCampaignsPage'))
const CrmServiceProductionPage = lazy(() => import('../pages/crm/CrmServiceProductionPage'))
const CrmProductionPage = lazy(() => import('../pages/crm/CrmProductionPage'))
const CrmCommissionsPage = lazy(() => import('../pages/crm/CrmCommissionsPage'))
const CrmCommissionsImportPage = lazy(() => import('../pages/crm/CrmCommissionsImportPage'))
const CrmCommissionsPendingImportPage = lazy(() => import('../pages/crm/CrmCommissionsPendingImportPage'))
const CrmProductionCatalogPage = lazy(() => import('../pages/crm/CrmProductionCatalogPage'))
const CrmProductionNewPage = lazy(() => import('../pages/crm/CrmProductionNewPage'))
const CrmProductionEditPage = lazy(() => import('../pages/crm/CrmProductionEditPage'))
const CrmProductionDetailPage = lazy(() => import('../pages/crm/CrmProductionDetailPage'))

const SpecialtyReportCardPreview = guidedReportCardsEnabled ? lazy(() => import('../pages/SpecialtyReportCardPreview')) : null

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
      <PublicRouteIndexing />
      <Suspense fallback={<p role="status" aria-live="polite">Loading page…</p>}>
      <Routes>
      {SpecialtyReportCardPreview && <>
       {import.meta.env.DEV && <>
        <Route path="/preview/report-cards/family" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="family" type="family" /></Suspense></SiteLayout>} />
        <Route path="/preview/report-cards/business" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="business" type="business" /></Suspense></SiteLayout>} />
        <Route path="/preview/report-cards/protection" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="protection" type="protection" /></Suspense></SiteLayout>} />
        <Route path="/preview/report-cards/retirement" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="retirement" type="retirement" /></Suspense></SiteLayout>} />
        <Route path="/preview/report-cards/credit" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="credit" type="credit" /></Suspense></SiteLayout>} />
        <Route path="/preview/report-cards/student_loan" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="student_loan" type="student_loan" /></Suspense></SiteLayout>} />
        <Route path="/preview/report-cards/home_buyer" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="home_buyer" type="home_buyer" /></Suspense></SiteLayout>} />
       </>}
        <Route path="/health-insurance-report-card" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="health" type="health" /></Suspense></SiteLayout>} />
        <Route path="/tsp-report-card" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="tsp" type="tsp" /></Suspense></SiteLayout>} />
        <Route path="/employee-benefits-report-card" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="benefits" type="benefits" /></Suspense></SiteLayout>} />
        <Route path="/tax-review-report-card" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="tax" type="tax" /></Suspense></SiteLayout>} />
        <Route path="/tax-planning-report-card" element={<SiteLayout><Suspense fallback={<p>Loading…</p>}><SpecialtyReportCardPreview key="tax" type="tax" /></Suspense></SiteLayout>} />
      </>}
      <Route path={ROUTES.reportCards} element={<SiteLayout><ReportCardsPage /></SiteLayout>} />
      <Route path={ROUTES.education} element={<SiteLayout><EducationPage /></SiteLayout>} />
      <Route path={ROUTES.getQuote} element={<SiteLayout><GetQuotePage /></SiteLayout>} />
      {(['auto', 'home', 'commercial'] as const).map(kind => <Route key={kind} path={`/${kind}-quote`} element={<SiteLayout><InsuranceQuotePage key={kind} kind={kind} /></SiteLayout>} />)}
      <Route path={ROUTES.familyAssessment} element={<ShortAssessment key="family" assessmentType="family" />} />
      <Route path="/assessment" element={<Navigate to={ROUTES.familyAssessment} replace />} />
      <Route path="/report" element={<Navigate to={ROUTES.familyAssessment} replace />} />

      <Route path={ROUTES.reportCardResults} element={<VersionedReportResults assessmentType="family" legacy={<FamilyReportCardResults />} />} />
      <Route path={ROUTES.businessReportCardResults} element={<VersionedReportResults assessmentType="business" legacy={<BusinessReportCardResults />} />} />
      <Route path={ROUTES.businessAssessment} element={<ShortAssessment key="business" assessmentType="business" />} />
      <Route path={ROUTES.retirementReportCardResults} element={<VersionedReportResults assessmentType="retirement" legacy={<RetirementReportCardResults />} />} />
      <Route path={ROUTES.retirementAssessment} element={<ShortAssessment key="retirement" assessmentType="retirement" />} />
      <Route path={ROUTES.studentLoanAssessment} element={<ShortAssessment key="student_loan" assessmentType="student_loan" />} />
      <Route path={ROUTES.studentLoanReportCardResults} element={<VersionedReportResults assessmentType="student_loan" legacy={<StudentLoanReportCardResults />} />} />
      <Route path={ROUTES.creditAssessment} element={<ShortAssessment key="credit" assessmentType="credit" />} />
      <Route path={ROUTES.creditReportCardResults} element={<VersionedReportResults assessmentType="credit" legacy={<CreditReportCardResults />} />} />
      <Route path={ROUTES.homeBuyerAssessment} element={<ShortAssessment key="home_buyer" assessmentType="home_buyer" />} />
      <Route path={ROUTES.homeBuyerReportCardResults} element={<VersionedReportResults assessmentType="home_buyer" legacy={<HomeBuyerReportCardResults />} />} />
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

      <Route path={ROUTES.protectionGap} element={<ShortAssessment key="protection" assessmentType="protection" />} />
      <Route path="/protectioncalc" element={<Navigate to={ROUTES.protectionGap} replace />} />
      <Route path="/calculator" element={<Navigate to={ROUTES.protectionGap} replace />} />

      <Route path={ROUTES.protectionResults} element={<VersionedReportResults assessmentType="protection" legacy={<FamilyProtectionResults />} />} />

      <Route
        path={ROUTES.reportCard}
        element={
          <SiteLayout>
            <ShortLanding assessmentType="family" />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.businessReportCard}
        element={
          <SiteLayout>
            <ShortLanding assessmentType="business" />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.retirementReportCard}
        element={
          <SiteLayout>
            <ShortLanding assessmentType="retirement" />
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
            <ShortLanding assessmentType="student_loan" />
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
            <ShortLanding assessmentType="credit" />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.homeBuyerReportCard}
        element={
          <SiteLayout>
            <ShortLanding assessmentType="home_buyer" />
          </SiteLayout>
        }
      />
      <Route
        path={ROUTES.protectionAnalysis}
        element={
          <SiteLayout>
            <ShortLanding assessmentType="protection" />
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
          <Route path="client-intakes/new" element={<CrmClientIntakeNewPage />} />
          <Route path="archived" element={<CrmArchivedRecordsPage />} />
          <Route path="households" element={<CrmHouseholdsPage />} />
          <Route path="households/:householdId/service-intake/:serviceId" element={<CrmAdditionalServiceIntakePage />} />
          <Route path="households/:householdId/student-loan-intake" element={<CrmStudentLoanIntakePage />} />
          <Route path="households/:householdId/life-insurance-intake" element={<CrmLifeInsuranceIntakePage />} />
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
          <Route path="recruiting" element={<CrmRecruitingPage />} />
          <Route path="recruiting/:recruitId" element={<CrmRecruitDetailPage />} />
          <Route path="opportunities/:opportunityId" element={<CrmOpportunityWorkspacePage />} />
          <Route path="student-loans" element={<CrmStudentLoansPage />} />
          <Route path="tasks" element={<CrmTasksPage />} />
          <Route path="operations" element={<CrmOperationsPage />} />
          <Route path="appointments" element={<CrmPlaceholderPage />} />
          <Route path="production/services" element={<CrmServiceProductionPage />} />
          <Route path="production/services/:serviceId" element={<CrmServiceProductionPage />} />
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
      </Suspense>
    </>
  )
}
