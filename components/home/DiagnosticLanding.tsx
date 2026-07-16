import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import HomeCardIcon, { type HomeCardIconVariant } from './HomeCardIcon'

export type DiagnosticLandingItem = {
  icon: HomeCardIconVariant
  title: string
  description: string
}

export type DiagnosticLandingStep = {
  step: string
  title: string
  description: string
}

export type DiagnosticLandingFaq = {
  question: string
  answer: string
}

export type DiagnosticLandingProps = {
  pageClassName: string
  eyebrow: string
  title: string
  heroCopies: string[]
  ctaLabel: string
  ctaTo: string
  heroMicrocopy: string
  receiveLead: string
  receiveItems: DiagnosticLandingItem[]
  sampleLead: string
  samplePreview: ReactNode
  categoriesHeading: string
  categoriesLead: string
  categories: DiagnosticLandingItem[]
  howLead: string
  howSteps: DiagnosticLandingStep[]
  faqLead?: string
  faqs: DiagnosticLandingFaq[]
  closingTitle: string
  closingCopy: string
  closingMicrocopy: string
}

export default function DiagnosticLanding({
  pageClassName,
  eyebrow,
  title,
  heroCopies,
  ctaLabel,
  ctaTo,
  heroMicrocopy,
  receiveLead,
  receiveItems,
  sampleLead,
  samplePreview,
  categoriesHeading,
  categoriesLead,
  categories,
  howLead,
  howSteps,
  faqLead = 'Straightforward answers before you begin.',
  faqs,
  closingTitle,
  closingCopy,
  closingMicrocopy,
}: DiagnosticLandingProps) {
  return (
    <div className={`platform-home diagnostic-landing ${pageClassName}`}>
      <section className="platform-hero diagnostic-hero">
        <div className="container diagnostic-hero-inner">
          <p className="platform-eyebrow">{eyebrow}</p>
          <h1 className="platform-headline diagnostic-hero-title">{title}</h1>
          {heroCopies.map((copy) => (
            <p key={copy} className="platform-subhead diagnostic-hero-copy">
              {copy}
            </p>
          ))}
          <div className="diagnostic-hero-actions">
            <Link className="platform-btn platform-btn-primary" to={ctaTo}>
              {ctaLabel}
            </Link>
          </div>
          <p className="funnel-microcopy">{heroMicrocopy}</p>
        </div>
      </section>

      <section className="platform-section platform-tone-blue" aria-labelledby="receive-heading">
        <div className="container platform-section-inner">
          <h2 id="receive-heading" className="platform-section-title">
            What You&apos;ll Receive
          </h2>
          <p className="platform-section-lead">{receiveLead}</p>
          <div className="diagnostic-receive-grid">
            {receiveItems.map((item) => (
              <article key={item.title} className="diagnostic-receive-card platform-card">
                <HomeCardIcon variant={item.icon} />
                <h3 className="diagnostic-receive-title">{item.title}</h3>
                <p className="diagnostic-receive-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-white" aria-labelledby="sample-heading">
        <div className="container platform-section-inner funnel-preview-section">
          <h2 id="sample-heading" className="platform-section-title">
            Sample Report Preview
          </h2>
          <p className="platform-section-lead">{sampleLead}</p>
          <div className="funnel-preview-stage">{samplePreview}</div>
        </div>
      </section>

      <section className="platform-section platform-tone-gray" aria-labelledby="categories-heading">
        <div className="container platform-section-inner">
          <h2 id="categories-heading" className="platform-section-title">
            {categoriesHeading}
          </h2>
          <p className="platform-section-lead">{categoriesLead}</p>
          <div className="funnel-category-grid">
            {categories.map((category) => (
              <article key={category.title} className="funnel-category-card platform-card">
                <HomeCardIcon variant={category.icon} />
                <h3 className="funnel-category-title">{category.title}</h3>
                <p className="funnel-category-copy">{category.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-blue" aria-labelledby="how-heading">
        <div className="container platform-section-inner">
          <h2 id="how-heading" className="platform-section-title">
            How It Works
          </h2>
          <p className="platform-section-lead">{howLead}</p>
          <div className="diagnostic-timeline">
            {howSteps.map((item, index) => (
              <Fragment key={item.title}>
                <article className="diagnostic-timeline-step platform-card">
                  <span className="diagnostic-timeline-number">{item.step}</span>
                  <h3 className="diagnostic-timeline-title">{item.title}</h3>
                  <p className="diagnostic-timeline-copy">{item.description}</p>
                </article>
                {index < howSteps.length - 1 ? (
                  <span className="diagnostic-timeline-arrow" aria-hidden="true">
                    ↓
                  </span>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-white" aria-labelledby="faq-heading">
        <div className="container platform-section-inner">
          <h2 id="faq-heading" className="platform-section-title">
            Frequently Asked Questions
          </h2>
          <p className="platform-section-lead">{faqLead}</p>
          <div className="diagnostic-faq-list">
            {faqs.map((faq) => (
              <article key={faq.question} className="diagnostic-faq-item platform-card">
                <h3 className="diagnostic-faq-question">{faq.question}</h3>
                <p className="diagnostic-faq-answer">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-closing platform-closing">
        <div className="container product-closing-inner">
          <h2 className="product-closing-title">{closingTitle}</h2>
          <p className="product-closing-copy">{closingCopy}</p>
          <div className="product-closing-actions">
            <Link className="platform-btn platform-btn-secondary" to={ctaTo}>
              {ctaLabel}
            </Link>
          </div>
          <p className="funnel-final-microcopy">{closingMicrocopy}</p>
        </div>
      </section>
    </div>
  )
}
