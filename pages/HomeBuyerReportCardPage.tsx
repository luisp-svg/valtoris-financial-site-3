import { useLocation } from 'react-router-dom'
import DiagnosticLanding from '../components/home/DiagnosticLanding'
import SpecializedSampleResultsPreview from '../components/home/SpecializedSampleResultsPreview'
import SpecializedLocaleSwitcher, {
  useSpecializedDocumentLang,
} from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import {
  readSpecializedLocale,
  resolveSpecializedCopy,
  withSpecializedLocale,
} from '../components/assessment/specialized/locale'
import type { SpecializedCopySection } from '../components/assessment/specialized/types'
import { homeBuyerCopy } from '../components/assessment/homeBuyer/copy'
import { ROUTES } from '../constants/routes'

export default function HomeBuyerReportCardPage() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(homeBuyerCopy, locale, section, key)
  }

  const assessmentTo = withSpecializedLocale(ROUTES.homeBuyerAssessment, locale, location.search)

  return (
    <DiagnosticLanding
      pageClassName="home-buyer-report-card-page"
      headerExtra={
        <SpecializedLocaleSwitcher
          locale={locale}
          groupLabel={t('ui', 'languageGroupLabel')}
          englishLabel={t('ui', 'languageEnglish')}
          spanishLabel={t('ui', 'languageSpanish')}
        />
      }
      eyebrow={t('ui', 'landingEyebrow')}
      title={t('ui', 'landingTitle')}
      heroCopies={[t('ui', 'landingHero1'), t('ui', 'landingHero2')]}
      ctaLabel={t('ui', 'startCta')}
      ctaTo={assessmentTo}
      receiveHeading={t('ui', 'landingReceiveHeading')}
      receiveLead={t('ui', 'landingReceiveLead')}
      receiveItems={[
        {
          icon: 'grade',
          title: t('ui', 'landingReceiveScoreTitle'),
          description: t('ui', 'landingReceiveScoreDescription'),
        },
        {
          icon: 'priorities',
          title: t('ui', 'landingReceiveFlagsTitle'),
          description: t('ui', 'landingReceiveFlagsDescription'),
        },
        {
          icon: 'strategy',
          title: t('ui', 'landingReceiveGoalTitle'),
          description: t('ui', 'landingReceiveGoalDescription'),
        },
        {
          icon: 'session',
          title: t('ui', 'landingReceiveSessionTitle'),
          description: t('ui', 'landingReceiveSessionDescription'),
        },
      ]}
      sampleHeading={t('ui', 'landingSampleHeading')}
      sampleLead={t('ui', 'landingSampleLead')}
      samplePreview={
        <SpecializedSampleResultsPreview
          ariaLabel={t('ui', 'landingSampleAriaLabel')}
          badge={t('ui', 'landingSampleBadge')}
          scoreLabel={t('results', 'score')}
          score={78}
          gradeLabel={t('results', 'grade')}
          grade="C+"
          statusLabel={t('results', 'status')}
          status={t('results', 'status.building_readiness')}
          barsLabel={t('results', 'categories')}
          bars={[
            { label: t('results', 'category.credit_readiness'), score: 82 },
            { label: t('results', 'category.savings_reserves'), score: 54 },
            { label: t('results', 'category.down_payment_readiness'), score: 48 },
            { label: t('results', 'category.documentation_readiness'), score: 70 },
          ]}
          flagHeading={t('ui', 'landingSampleFlagHeading')}
          flag={{
            badge: t('results', 'flag.review_recommended'),
            title: t('ui', 'landingSampleFlagTitle'),
          }}
          reviewHeading={t('ui', 'landingSampleReviewHeading')}
          reviewAreas={[
            { title: t('ui', 'landingSampleReview1') },
            { title: t('ui', 'landingSampleReview2') },
            { title: t('ui', 'landingSampleReview3') },
          ]}
          disclaimer={t('ui', 'landingSampleDisclaimer')}
        />
      }
      categoriesHeading={t('ui', 'landingCategoriesHeading')}
      categoriesLead={t('ui', 'landingCategoriesLead')}
      categories={[
        {
          icon: 'credit',
          title: t('ui', 'landingCategoryCreditTitle'),
          description: t('ui', 'landingCategoryCreditDescription'),
        },
        {
          icon: 'cashflow',
          title: t('ui', 'landingCategoryIncomeTitle'),
          description: t('ui', 'landingCategoryIncomeDescription'),
        },
        {
          icon: 'emergency',
          title: t('ui', 'landingCategoryDebtTitle'),
          description: t('ui', 'landingCategoryDebtDescription'),
        },
        {
          icon: 'independence',
          title: t('ui', 'landingCategorySavingsTitle'),
          description: t('ui', 'landingCategorySavingsDescription'),
        },
        {
          icon: 'picture',
          title: t('ui', 'landingCategoryDocsTitle'),
          description: t('ui', 'landingCategoryDocsDescription'),
        },
        {
          icon: 'strategy',
          title: t('ui', 'landingCategoryTimelineTitle'),
          description: t('ui', 'landingCategoryTimelineDescription'),
        },
      ]}
      howHeading={t('ui', 'landingHowHeading')}
      howLead={t('ui', 'landingHowLead')}
      howSteps={[
        { step: '1', title: t('ui', 'landingHow1Title'), description: t('ui', 'landingHow1Description') },
        { step: '2', title: t('ui', 'landingHow2Title'), description: t('ui', 'landingHow2Description') },
        { step: '3', title: t('ui', 'landingHow3Title'), description: t('ui', 'landingHow3Description') },
        { step: '4', title: t('ui', 'landingHow4Title'), description: t('ui', 'landingHow4Description') },
      ]}
      faqHeading={t('ui', 'landingFaqHeading')}
      faqLead={t('ui', 'landingFaqLead')}
      faqs={[
        { question: t('ui', 'landingFaq1'), answer: t('ui', 'landingFaqA1') },
        { question: t('ui', 'landingFaq2'), answer: t('ui', 'landingFaqA2') },
        { question: t('ui', 'landingFaq3'), answer: t('ui', 'landingFaqA3') },
        { question: t('ui', 'landingFaq4'), answer: t('ui', 'landingFaqA4') },
        { question: t('ui', 'landingFaq5'), answer: t('ui', 'landingFaqA5') },
      ]}
      complianceNote={t('ui', 'landingCompliance')}
      closingTitle={t('ui', 'landingClosingTitle')}
      closingCopy={t('ui', 'landingClosingCopy')}
      closingMicrocopy={t('ui', 'landingClosingMicrocopy')}
    />
  )
}
