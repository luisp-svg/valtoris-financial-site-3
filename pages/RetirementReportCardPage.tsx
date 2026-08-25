import DiagnosticLanding from '../components/home/DiagnosticLanding'
import RetirementSampleResultsPreview from '../components/home/RetirementSampleResultsPreview'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import { retirementCopy } from '../components/assessment/retirement/copy'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { ROUTES } from '../constants/routes'

export default function RetirementReportCardPage() {
  const { locale, t, withLocale } = useReportCardCopy(retirementCopy)

  return (
    <DiagnosticLanding
      pageClassName="retirement-report-card-page"
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
      ctaTo={withLocale(ROUTES.retirementAssessment)}
      heroMicrocopy={t('ui', 'landingMicrocopy')}
      receiveHeading={t('ui', 'landingReceiveHeading')}
      receiveLead={t('ui', 'landingReceiveLead')}
      receiveItems={[
        {
          icon: 'grade',
          title: t('ui', 'landingReceive1Title'),
          description: t('ui', 'landingReceive1Description'),
        },
        {
          icon: 'cashflow',
          title: t('ui', 'landingReceive2Title'),
          description: t('ui', 'landingReceive2Description'),
        },
        {
          icon: 'retirement',
          title: t('ui', 'landingReceive3Title'),
          description: t('ui', 'landingReceive3Description'),
        },
        {
          icon: 'blueprint',
          title: t('ui', 'landingReceive4Title'),
          description: t('ui', 'landingReceive4Description'),
        },
      ]}
      sampleHeading={t('ui', 'landingSampleHeading')}
      sampleLead={t('ui', 'landingSampleLead')}
      samplePreview={
        <RetirementSampleResultsPreview
          ariaLabel={t('ui', 'landingSampleAriaLabel')}
          badge={t('ui', 'landingSampleBadge')}
          scoreLabel={t('ui', 'landingSampleScore')}
          gradeLabel={t('ui', 'landingSampleGrade')}
          readinessLabel={t('ui', 'landingSampleReadiness')}
          strongestLabel={t('ui', 'landingSampleStrongest')}
          priorityLabel={t('ui', 'landingSamplePriority')}
          retirementAgeLabel={t('ui', 'landingSampleRetirementAge')}
          monthlyNeedLabel={t('ui', 'landingSampleMonthlyNeed')}
          monthlyIncomeLabel={t('ui', 'landingSampleMonthlyIncome')}
          monthlyGapLabel={t('ui', 'landingSampleMonthlyGap')}
          fundedRatioLabel={t('ui', 'landingSampleFundedRatio')}
          barsLabel={t('ui', 'landingSampleBarsLabel')}
          bars={[
            { label: t('ui', 'landingSampleBarSavings'), score: 78 },
            { label: t('ui', 'landingSampleBarIncomeSources'), score: 64 },
            { label: t('ui', 'landingSampleBarSustainability'), score: 58 },
            { label: t('ui', 'landingSampleBarInvestments'), score: 71 },
          ]}
          immediateTitle={t('ui', 'landingSampleImmediate')}
          plan30Title={t('ui', 'landingSample30')}
          plan90Title={t('ui', 'landingSample90')}
          immediateItems={[
            t('ui', 'landingSampleImmediate1'),
            t('ui', 'landingSampleImmediate2'),
          ]}
          plan30Items={[
            t('ui', 'landingSample30_1'),
            t('ui', 'landingSample30_2'),
            t('ui', 'landingSample30_3'),
          ]}
          plan90Items={[
            t('ui', 'landingSample90_1'),
            t('ui', 'landingSample90_2'),
            t('ui', 'landingSample90_3'),
          ]}
          disclaimer={t('ui', 'landingSampleDisclaimer')}
        />
      }
      categoriesHeading={t('ui', 'landingCategoriesHeading')}
      categoriesLead={t('ui', 'landingCategoriesLead')}
      categories={[
        {
          icon: 'picture',
          title: t('ui', 'landingCategory1Title'),
          description: t('ui', 'landingCategory1Description'),
        },
        {
          icon: 'retirement',
          title: t('ui', 'landingCategory2Title'),
          description: t('ui', 'landingCategory2Description'),
        },
        {
          icon: 'cashflow',
          title: t('ui', 'landingCategory3Title'),
          description: t('ui', 'landingCategory3Description'),
        },
        {
          icon: 'strategy',
          title: t('ui', 'landingCategory4Title'),
          description: t('ui', 'landingCategory4Description'),
        },
        {
          icon: 'credit',
          title: t('ui', 'landingCategory5Title'),
          description: t('ui', 'landingCategory5Description'),
        },
        {
          icon: 'independence',
          title: t('ui', 'landingCategory6Title'),
          description: t('ui', 'landingCategory6Description'),
        },
        {
          icon: 'emergency',
          title: t('ui', 'landingCategory7Title'),
          description: t('ui', 'landingCategory7Description'),
        },
        {
          icon: 'estate',
          title: t('ui', 'landingCategory8Title'),
          description: t('ui', 'landingCategory8Description'),
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
        { question: t('ui', 'landingFaq6'), answer: t('ui', 'landingFaqA6') },
        { question: t('ui', 'landingFaq7'), answer: t('ui', 'landingFaqA7') },
      ]}
      closingTitle={t('ui', 'landingClosingTitle')}
      closingCopy={t('ui', 'landingClosingCopy')}
      closingMicrocopy={t('ui', 'landingClosingMicrocopy')}
    />
  )
}
