import DiagnosticLanding from '../components/home/DiagnosticLanding'
import ProtectionSampleResultsPreview from '../components/home/ProtectionSampleResultsPreview'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { protectionCopy } from '../components/calculator/protectionCopy'
import { ROUTES } from '../constants/routes'

export default function ProtectionAnalysisPage() {
  const { locale, t, withLocale } = useReportCardCopy(protectionCopy)

  return (
    <DiagnosticLanding
      pageClassName="protection-analysis-page"
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
      ctaTo={withLocale(ROUTES.protectionGap)}
      heroMicrocopy={t('ui', 'landingMicrocopy')}
      receiveHeading={t('ui', 'landingReceiveHeading')}
      receiveLead={t('ui', 'landingReceiveLead')}
      receiveItems={[
        { icon: 'grade', title: t('ui', 'landingReceive1Title'), description: t('ui', 'landingReceive1Description') },
        { icon: 'protection', title: t('ui', 'landingReceive2Title'), description: t('ui', 'landingReceive2Description') },
        { icon: 'priorities', title: t('ui', 'landingReceive3Title'), description: t('ui', 'landingReceive3Description') },
        { icon: 'blueprint', title: t('ui', 'landingReceive4Title'), description: t('ui', 'landingReceive4Description') },
      ]}
      sampleHeading={t('ui', 'landingSampleHeading')}
      sampleLead={t('ui', 'landingSampleLead')}
      samplePreview={
        <ProtectionSampleResultsPreview
          ariaLabel={t('ui', 'landingSampleAriaLabel')}
          badge={t('ui', 'landingSampleBadge')}
          coverageLabel={t('ui', 'landingSampleCoverageLabel')}
          currentCoverageLabel={t('ui', 'landingSampleCurrentLabel')}
          gapLabel={t('ui', 'landingSampleGapLabel')}
          gapNote={t('ui', 'landingSampleGapNote')}
          prioritiesTitle={t('ui', 'landingSamplePrioritiesTitle')}
          priorities={[
            t('ui', 'landingSamplePriority1'),
            t('ui', 'landingSamplePriority2'),
            t('ui', 'landingSamplePriority3'),
          ]}
          disclaimer={t('ui', 'landingSampleDisclaimer')}
        />
      }
      categoriesHeading={t('ui', 'landingCategoriesHeading')}
      categoriesLead={t('ui', 'landingCategoriesLead')}
      categories={[
        { icon: 'cashflow', title: t('ui', 'landingCategory1Title'), description: t('ui', 'landingCategory1Description') },
        { icon: 'emergency', title: t('ui', 'landingCategory2Title'), description: t('ui', 'landingCategory2Description') },
        { icon: 'debt', title: t('ui', 'landingCategory3Title'), description: t('ui', 'landingCategory3Description') },
        { icon: 'estate', title: t('ui', 'landingCategory4Title'), description: t('ui', 'landingCategory4Description') },
        { icon: 'session', title: t('ui', 'landingCategory5Title'), description: t('ui', 'landingCategory5Description') },
        { icon: 'credit', title: t('ui', 'landingCategory6Title'), description: t('ui', 'landingCategory6Description') },
        { icon: 'protection', title: t('ui', 'landingCategory7Title'), description: t('ui', 'landingCategory7Description') },
        { icon: 'strategy', title: t('ui', 'landingCategory8Title'), description: t('ui', 'landingCategory8Description') },
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
        { question: t('ui', 'landingFaq6'), answer: t('ui', 'landingFaqA6') },
        { question: t('ui', 'landingFaq7'), answer: t('ui', 'landingFaqA7') },
      ]}
      closingTitle={t('ui', 'landingClosingTitle')}
      closingCopy={t('ui', 'landingClosingCopy')}
      closingMicrocopy={t('ui', 'landingClosingMicrocopy')}
    />
  )
}
