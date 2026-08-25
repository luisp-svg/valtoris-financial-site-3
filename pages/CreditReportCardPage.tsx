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
import { creditCopy } from '../components/assessment/credit/copy'
import { ROUTES } from '../constants/routes'

export default function CreditReportCardPage() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(creditCopy, locale, section, key)
  }

  const assessmentTo = withSpecializedLocale(ROUTES.creditAssessment, locale, location.search)

  return (
    <DiagnosticLanding
      pageClassName="credit-report-card-page"
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
          score={73}
          gradeLabel={t('results', 'grade')}
          grade="C"
          statusLabel={t('results', 'status')}
          status={t('results', 'status.review_recommended')}
          barsLabel={t('results', 'categories')}
          bars={[
            { label: t('results', 'category.payment_history'), score: 82 },
            { label: t('results', 'category.utilization'), score: 48 },
            { label: t('results', 'category.negative_items'), score: 61 },
            { label: t('results', 'category.credit_structure'), score: 70 },
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
          icon: 'picture',
          title: t('ui', 'landingCategoryGoalTitle'),
          description: t('ui', 'landingCategoryGoalDescription'),
        },
        {
          icon: 'credit',
          title: t('ui', 'landingCategoryScoreTitle'),
          description: t('ui', 'landingCategoryScoreDescription'),
        },
        {
          icon: 'strategy',
          title: t('ui', 'landingCategoryReviewTitle'),
          description: t('ui', 'landingCategoryReviewDescription'),
        },
        {
          icon: 'cashflow',
          title: t('ui', 'landingCategoryPaymentTitle'),
          description: t('ui', 'landingCategoryPaymentDescription'),
        },
        {
          icon: 'emergency',
          title: t('ui', 'landingCategoryNegativeTitle'),
          description: t('ui', 'landingCategoryNegativeDescription'),
        },
        {
          icon: 'independence',
          title: t('ui', 'landingCategoryUtilizationTitle'),
          description: t('ui', 'landingCategoryUtilizationDescription'),
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
