import { useLocation } from 'react-router-dom'
import DiagnosticLanding from '../components/home/DiagnosticLanding'
import SpecializedLocaleSwitcher, {
  useSpecializedDocumentLang,
} from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import {
  readSpecializedLocale,
  resolveSpecializedCopy,
  withSpecializedLocale,
} from '../components/assessment/specialized/locale'
import type { SpecializedCopySection } from '../components/assessment/specialized/types'
import { studentLoanCopy } from '../components/assessment/studentLoan/copy'
import { ROUTES } from '../constants/routes'

export default function StudentLoanReportCardPage() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(studentLoanCopy, locale, section, key)
  }

  const assessmentTo = withSpecializedLocale(ROUTES.studentLoanAssessment, locale, location.search)

  return (
    <DiagnosticLanding
      pageClassName="student-loan-report-card-page"
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
      heroMicrocopy={t('ui', 'landingHeroMicrocopy')}
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
        <article className="platform-card funnel-preview-card">
          <p className="platform-eyebrow">{t('ui', 'landingSampleEyebrow')}</p>
          <h3 className="diagnostic-receive-title">{t('ui', 'landingSampleTitle')}</h3>
          <ul className="diagnostic-faq-answer">
            <li>{t('ui', 'landingSampleItem1')}</li>
            <li>{t('ui', 'landingSampleItem2')}</li>
            <li>{t('ui', 'landingSampleItem3')}</li>
            <li>{t('ui', 'landingSampleItem4')}</li>
          </ul>
          <p className="funnel-microcopy">{t('ui', 'landingSampleMicrocopy')}</p>
        </article>
      }
      categoriesHeading={t('ui', 'landingCategoriesHeading')}
      categoriesLead={t('ui', 'landingCategoriesLead')}
      categories={[
        {
          icon: 'picture',
          title: t('ui', 'landingCategoryStructureTitle'),
          description: t('ui', 'landingCategoryStructureDescription'),
        },
        {
          icon: 'credit',
          title: t('ui', 'landingCategoryStatusTitle'),
          description: t('ui', 'landingCategoryStatusDescription'),
        },
        {
          icon: 'strategy',
          title: t('ui', 'landingCategoryRepaymentTitle'),
          description: t('ui', 'landingCategoryRepaymentDescription'),
        },
        {
          icon: 'cashflow',
          title: t('ui', 'landingCategoryIncomeTitle'),
          description: t('ui', 'landingCategoryIncomeDescription'),
        },
        {
          icon: 'independence',
          title: t('ui', 'landingCategoryEmploymentTitle'),
          description: t('ui', 'landingCategoryEmploymentDescription'),
        },
        {
          icon: 'emergency',
          title: t('ui', 'landingCategoryPaymentTitle'),
          description: t('ui', 'landingCategoryPaymentDescription'),
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
      closingTitle={t('ui', 'landingClosingTitle')}
      closingCopy={t('ui', 'landingClosingCopy')}
      closingMicrocopy={t('ui', 'landingClosingMicrocopy')}
    />
  )
}
